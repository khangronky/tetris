"use client";

import type { RefObject } from "react";
import { forwardRef, useEffect, useRef } from "react";

import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./game-data";
import type { GameSnapshot, PoseId } from "./types";

type CompositorCanvasProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  snapshot: GameSnapshot;
};

export const CompositorCanvas = forwardRef<
  HTMLCanvasElement,
  CompositorCanvasProps
>(function CompositorCanvas({ videoRef, snapshot }, ref) {
  const localCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    let frameId = 0;

    function draw() {
      const canvas = localCanvasRef.current;
      const context = canvas?.getContext("2d");

      if (canvas && context) {
        drawCompositedFrame({
          context,
          video: videoRef.current,
          snapshot: snapshotRef.current,
          now: performance.now(),
        });
      }

      frameId = requestAnimationFrame(draw);
    }

    draw();

    return () => cancelAnimationFrame(frameId);
  }, [videoRef]);

  return (
    <canvas
      ref={(node) => {
        localCanvasRef.current = node;

        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      className="aspect-[9/16] w-full rounded-[28px] border border-white/20 bg-background shadow-[0_28px_80px_rgba(0,27,84,0.22)]"
    />
  );
});

function drawCompositedFrame({
  context,
  video,
  snapshot,
  now,
}: {
  context: CanvasRenderingContext2D;
  video: HTMLVideoElement | null;
  snapshot: GameSnapshot;
  now: number;
}) {
  const width = CANVAS_WIDTH;
  const height = CANVAS_HEIGHT;

  context.clearRect(0, 0, width, height);
  drawBackground(context, width, height, now);

  if (video && video.videoWidth > 0 && video.videoHeight > 0) {
    drawMirroredVideo(context, video, width, height);
  } else {
    drawCameraPlaceholder(context, width, height);
  }

  drawPerspectiveGrid(context, width, height, now);
  drawWall(context, snapshot, width, height, now);
  drawHud(context, snapshot, width, height);
  drawFeedbackBurst(context, snapshot, width, height, now);

  if (snapshot.status === "countdown" && snapshot.countdown) {
    drawCountdown(context, snapshot.countdown, width, height);
  }

  if (snapshot.status === "finished") {
    drawFinalCard(context, snapshot, width);
  }
}

function drawBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#f8fcff");
  gradient.addColorStop(0.5, "#eef8ff");
  gradient.addColorStop(1, "#f7f2ff");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(2, 31, 84, 0.07)";
  const offset = (now / 32) % 64;

  for (let x = -64; x < width + 64; x += 64) {
    context.fillRect(x + offset, 0, 2, height);
  }

  for (let y = -64; y < height + 64; y += 64) {
    context.fillRect(0, y + offset, width, 2);
  }
}

function drawMirroredVideo(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  const videoRatio = video.videoWidth / video.videoHeight;
  const canvasRatio = width / height;
  let sourceWidth = video.videoWidth;
  let sourceHeight = video.videoHeight;
  let sourceX = 0;
  let sourceY = 0;

  if (videoRatio > canvasRatio) {
    sourceWidth = sourceHeight * canvasRatio;
    sourceX = (video.videoWidth - sourceWidth) / 2;
  } else {
    sourceHeight = sourceWidth / canvasRatio;
    sourceY = (video.videoHeight - sourceHeight) / 2;
  }

  context.save();
  context.translate(width, 0);
  context.scale(-1, 1);
  context.drawImage(
    video,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
  context.restore();

  const shade = context.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, "rgba(255, 255, 255, 0.62)");
  shade.addColorStop(0.45, "rgba(255, 255, 255, 0.1)");
  shade.addColorStop(1, "rgba(6, 27, 76, 0.32)");
  context.fillStyle = shade;
  context.fillRect(0, 0, width, height);
}

function drawCameraPlaceholder(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  context.fillStyle = "rgba(255, 255, 255, 0.58)";
  roundRect(context, 120, 470, width - 240, 760, 54);
  context.fill();
  context.strokeStyle = "rgba(0, 132, 255, 0.28)";
  context.lineWidth = 4;
  context.stroke();

  context.fillStyle = "#06204c";
  context.font = "700 58px sans-serif";
  context.textAlign = "center";
  context.fillText("Camera preview", width / 2, height / 2 - 20);
  context.font = "400 34px sans-serif";
  context.fillStyle = "rgba(6, 32, 76, 0.68)";
  context.fillText(
    "Start camera to load body tracking",
    width / 2,
    height / 2 + 44,
  );
}

function drawPerspectiveGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
) {
  context.save();
  context.globalAlpha = 0.32;
  context.strokeStyle = "rgba(0, 194, 255, 0.42)";
  context.lineWidth = 2;
  const vanishingX = width / 2;
  const vanishingY = height * 0.46;

  for (let index = -7; index <= 7; index += 1) {
    context.beginPath();
    context.moveTo(vanishingX, vanishingY);
    context.lineTo(width / 2 + index * 138, height);
    context.stroke();
  }

  const pulse = (now / 18) % 110;

  for (let y = height * 0.52 + pulse; y < height; y += 110) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  context.restore();
}

function drawHud(
  context: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  width: number,
  height: number,
) {
  const time = Math.max(0, Math.ceil(snapshot.timeLeftMs / 1000));
  drawGlassPill(context, 48, 48, 235, 86, "TIME", `${time}s`);
  drawGlassPill(
    context,
    width - 345,
    48,
    297,
    86,
    "SCORE",
    `${snapshot.score}`,
  );

  context.fillStyle = "#061b4d";
  context.textAlign = "left";
  context.font = "900 48px sans-serif";
  context.fillText("RISE", 52, 182);
  context.font = "500 22px sans-serif";
  context.fillStyle = "rgba(6, 27, 77, 0.58)";
  context.fillText("Founder Edition", 52, 214);

  drawGlassPanel(context, 58, height - 252, width - 116, 168, 34);
  context.textAlign = "left";
  context.fillStyle = "#061b4d";
  context.font = "800 34px sans-serif";
  context.fillText(snapshot.feedback, 92, height - 188);
  context.font = "600 28px sans-serif";
  context.fillStyle = "rgba(6, 27, 77, 0.72)";
  context.fillText(
    `Combo ${snapshot.combo}   Walls ${snapshot.wallsPassed}/${snapshot.wallsAttempted}`,
    92,
    height - 136,
  );

  const barX = 92;
  const barY = height - 108;
  const barWidth = width - 184;
  context.fillStyle = "rgba(6, 27, 77, 0.14)";
  roundRect(context, barX, barY, barWidth, 14, 7);
  context.fill();
  const progress = context.createLinearGradient(
    barX,
    barY,
    barX + barWidth,
    barY,
  );
  progress.addColorStop(0, "#00c2ff");
  progress.addColorStop(1, "#7c5cff");
  context.fillStyle = progress;
  roundRect(context, barX, barY, barWidth * snapshot.alignment, 14, 7);
  context.fill();
}

function drawWall(
  context: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  width: number,
  height: number,
  now: number,
) {
  if (snapshot.status !== "playing" && snapshot.status !== "countdown") {
    return;
  }

  const distance = snapshot.status === "countdown" ? 1 : snapshot.distance;
  const scale = 0.58 + (1 - distance) * 0.62;
  const panelWidth = width * 0.68 * scale;
  const panelHeight = height * 0.36 * scale;
  const x = (width - panelWidth) / 2;
  const y = height * (0.2 + distance * 0.13);
  const rotation =
    ((snapshot.difficulty.rotationDeg * (1 - distance)) / 180) * Math.PI;

  context.save();
  context.translate(width / 2, y + panelHeight / 2);
  context.rotate(rotation);
  context.translate(-width / 2, -(y + panelHeight / 2));

  const wallGradient = context.createLinearGradient(x, y, x + panelWidth, y);
  wallGradient.addColorStop(0, "rgba(255, 255, 255, 0.72)");
  wallGradient.addColorStop(0.5, "rgba(225, 248, 255, 0.54)");
  wallGradient.addColorStop(1, "rgba(235, 229, 255, 0.62)");
  context.fillStyle = wallGradient;
  roundRect(context, x, y, panelWidth, panelHeight, 42);
  context.fill();
  const burstOpacity = getFeedbackBurstOpacity(snapshot, now);
  context.strokeStyle =
    burstOpacity > 0 && snapshot.feedbackBurst
      ? getFeedbackColor(snapshot.feedbackBurst.kind, 0.5 + burstOpacity * 0.38)
      : "rgba(0, 132, 255, 0.62)";
  context.lineWidth = 6;
  context.shadowColor =
    burstOpacity > 0 && snapshot.feedbackBurst
      ? getFeedbackColor(snapshot.feedbackBurst.kind, 0.45)
      : "transparent";
  context.shadowBlur = burstOpacity * 28;
  context.stroke();

  context.fillStyle = "rgba(6, 27, 77, 0.72)";
  context.font = "900 35px sans-serif";
  context.textAlign = "center";
  context.fillText(snapshot.currentWall.title, width / 2, y + 70 * scale);
  context.font = "600 23px sans-serif";
  context.fillStyle = "rgba(6, 27, 77, 0.58)";
  context.fillText(snapshot.currentWall.theme, width / 2, y + 108 * scale);

  drawPoseGuide(
    context,
    snapshot.currentWall.poseId,
    width / 2,
    y + panelHeight * 0.58,
    230 * snapshot.difficulty.holeScale * scale,
    now,
  );

  context.restore();

  context.fillStyle = "rgba(6, 27, 77, 0.74)";
  context.font = "700 25px sans-serif";
  context.textAlign = "center";
  context.fillText(
    `Incoming wall: ${Math.round((1 - distance) * 100)}%`,
    width / 2,
    y + panelHeight + 72,
  );
}

function drawFeedbackBurst(
  context: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  width: number,
  height: number,
  now: number,
) {
  const burst = snapshot.feedbackBurst;
  const opacity = getFeedbackBurstOpacity(snapshot, now);

  if (!burst || opacity <= 0) {
    return;
  }

  const label = burst.kind === "success" ? "MATCHED" : "MISSED";
  const x = 82;
  const y = height * 0.39;
  const panelWidth = width - 164;
  const panelHeight = 178;

  context.save();
  context.globalAlpha = opacity;

  const vignette = context.createRadialGradient(
    width / 2,
    height * 0.42,
    width * 0.05,
    width / 2,
    height * 0.42,
    height * 0.64,
  );
  vignette.addColorStop(0, getFeedbackColor(burst.kind, 0.08));
  vignette.addColorStop(1, getFeedbackColor(burst.kind, 0.28));
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = getFeedbackColor(burst.kind, 0.82);
  context.lineWidth = 10;
  context.shadowColor = getFeedbackColor(burst.kind, 0.5);
  context.shadowBlur = 42;
  roundRect(context, 26, 26, width - 52, height - 52, 38);
  context.stroke();

  context.shadowBlur = 34;
  context.fillStyle = "rgba(255, 255, 255, 0.78)";
  roundRect(context, x, y, panelWidth, panelHeight, 36);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = getFeedbackColor(burst.kind, 0.58);
  context.lineWidth = 3;
  context.stroke();

  context.textAlign = "center";
  context.font = "900 28px sans-serif";
  context.fillStyle = getFeedbackColor(burst.kind, 1);
  context.fillText(label, width / 2, y + 48);

  context.font = "900 48px sans-serif";
  context.fillStyle = "#061b4d";
  context.fillText(
    truncateCanvasText(context, burst.message, panelWidth - 72),
    width / 2,
    y + 105,
  );

  context.font = "700 26px sans-serif";
  context.fillStyle = "rgba(6, 27, 77, 0.68)";
  context.fillText(
    `${Math.round(burst.alignment * 100)}% alignment`,
    width / 2,
    y + 148,
  );

  context.restore();
}

function getFeedbackBurstOpacity(snapshot: GameSnapshot, now: number) {
  const burst = snapshot.feedbackBurst;

  if (!burst || snapshot.status === "finished") {
    return 0;
  }

  const age = now - burst.startedAtMs;

  if (age < 0) {
    return 0;
  }

  if (age <= burst.holdMs) {
    return 1;
  }

  if (age <= burst.holdMs + burst.fadeMs) {
    return 1 - (age - burst.holdMs) / burst.fadeMs;
  }

  return 0;
}

function getFeedbackColor(kind: "success" | "fail", alpha: number) {
  return kind === "success"
    ? `rgba(22, 199, 132, ${alpha})`
    : `rgba(255, 59, 92, ${alpha})`;
}

function truncateCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  if (context.measureText(text).width <= maxWidth) {
    return text;
  }

  let end = text.length;

  while (end > 0) {
    const candidate = `${text.slice(0, end).trimEnd()}...`;

    if (context.measureText(candidate).width <= maxWidth) {
      return candidate;
    }

    end -= 1;
  }

  return "...";
}

function drawPoseGuide(
  context: CanvasRenderingContext2D,
  poseId: PoseId,
  centerX: number,
  centerY: number,
  scale: number,
  now: number,
) {
  const pulse = 0.78 + Math.sin(now / 180) * 0.12;
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = `rgba(0, 194, 255, ${pulse})`;
  context.lineWidth = Math.max(9, scale * 0.05);
  context.shadowColor = "rgba(0, 194, 255, 0.56)";
  context.shadowBlur = 22;

  const headY = centerY - scale * 0.62;
  const shoulderY = centerY - scale * 0.34;
  const hipY = centerY + scale * 0.16;
  const footY = centerY + scale * 0.62;
  const shoulderLeft = centerX - scale * 0.22;
  const shoulderRight = centerX + scale * 0.22;
  const hipLeft = centerX - scale * 0.16;
  const hipRight = centerX + scale * 0.16;

  context.beginPath();
  context.arc(centerX, headY, scale * 0.12, 0, Math.PI * 2);
  context.stroke();

  line(context, centerX, headY + scale * 0.12, centerX, hipY);
  line(context, shoulderLeft, shoulderY, shoulderRight, shoulderY);
  line(context, hipLeft, hipY, hipRight, hipY);
  line(context, hipLeft, hipY, centerX - scale * 0.26, footY);
  line(context, hipRight, hipY, centerX + scale * 0.26, footY);

  switch (poseId) {
    case "idea":
    case "fundingClosed":
      line(context, shoulderLeft, shoulderY, centerX - scale * 0.42, headY);
      line(context, shoulderRight, shoulderY, centerX + scale * 0.42, headY);
      break;
    case "investorPitch":
    case "demoDay":
      line(context, shoulderLeft, shoulderY, centerX - scale * 0.56, shoulderY);
      line(context, shoulderRight, shoulderY, centerX + scale * 0.18, hipY);
      break;
    case "mvpTyping":
      line(context, shoulderLeft, shoulderY, centerX - scale * 0.13, hipY);
      line(context, shoulderRight, shoulderY, centerX + scale * 0.13, hipY);
      break;
    case "networking":
      line(context, shoulderRight, shoulderY, centerX + scale * 0.5, centerY);
      line(context, shoulderLeft, shoulderY, centerX - scale * 0.12, hipY);
      break;
    case "problemSolving":
      line(context, shoulderRight, shoulderY, centerX + scale * 0.06, headY);
      line(context, shoulderLeft, shoulderY, centerX - scale * 0.2, hipY);
      break;
    case "welcomeTeam":
      line(context, shoulderLeft, shoulderY, centerX - scale * 0.66, centerY);
      line(context, shoulderRight, shoulderY, centerX + scale * 0.66, centerY);
      break;
    case "ceoMindset":
      line(context, shoulderLeft, shoulderY, hipLeft, hipY);
      line(context, shoulderRight, shoulderY, hipRight, hipY);
      break;
    case "scaleUp":
      line(
        context,
        shoulderRight,
        shoulderY,
        centerX + scale * 0.28,
        headY - scale * 0.28,
      );
      line(context, shoulderLeft, shoulderY, hipLeft, hipY);
      break;
  }

  context.restore();
}

function drawCountdown(
  context: CanvasRenderingContext2D,
  countdown: number,
  width: number,
  height: number,
) {
  context.save();
  context.fillStyle = "rgba(255, 255, 255, 0.72)";
  roundRect(context, width / 2 - 158, height / 2 - 158, 316, 316, 60);
  context.fill();
  context.strokeStyle = "rgba(0, 132, 255, 0.62)";
  context.lineWidth = 5;
  context.stroke();
  context.fillStyle = "#061b4d";
  context.textAlign = "center";
  context.font = "900 164px sans-serif";
  context.fillText(`${countdown}`, width / 2, height / 2 + 58);
  context.restore();
}

function drawFinalCard(
  context: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  width: number,
) {
  drawGlassPanel(context, 90, 430, width - 180, 820, 56);
  context.textAlign = "center";
  context.fillStyle = "#061b4d";
  context.font = "900 56px sans-serif";
  context.fillText("Founder Score", width / 2, 540);
  context.font = "900 132px sans-serif";
  context.fillText(`${snapshot.score}`, width / 2, 685);

  context.font = "900 48px sans-serif";
  context.fillStyle = "#0a84ff";
  context.fillText(snapshot.rank.toUpperCase(), width / 2, 780);

  context.font = "700 32px sans-serif";
  context.fillStyle = "rgba(6, 27, 77, 0.78)";
  context.fillText(
    `Walls Passed ${snapshot.wallsPassed}   Longest Combo ${snapshot.longestCombo}`,
    width / 2,
    870,
  );
  context.fillText("Can your friends beat you?", width / 2, 940);
}

function drawGlassPill(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
) {
  drawGlassPanel(context, x, y, width, height, 24);
  context.fillStyle = "rgba(6, 27, 77, 0.56)";
  context.font = "700 18px sans-serif";
  context.textAlign = "left";
  context.fillText(label, x + 28, y + 31);
  context.fillStyle = "#061b4d";
  context.font = "900 34px sans-serif";
  context.fillText(value, x + 28, y + 67);
}

function drawGlassPanel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.save();
  context.fillStyle = "rgba(255, 255, 255, 0.66)";
  roundRect(context, x, y, width, height, radius);
  context.fill();
  context.strokeStyle = "rgba(255, 255, 255, 0.76)";
  context.lineWidth = 2;
  context.stroke();
  context.restore();
}

function line(
  context: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
) {
  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}
