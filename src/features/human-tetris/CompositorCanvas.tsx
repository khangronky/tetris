"use client";

import type { RefObject } from "react";
import { forwardRef, useEffect, useRef } from "react";

import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./game-data";
import type { GameSnapshot } from "./types";

// Module-level logo cache — loaded once, reused every frame.
let logoImage: HTMLImageElement | null = null;
let logoLoading = false;

function getLogoImage(): HTMLImageElement | null {
  if (logoImage) return logoImage;
  if (logoLoading || typeof window === "undefined") return null;
  logoLoading = true;
  const img = new window.Image();
  img.src = "/logo.png";
  img.onload = () => {
    logoImage = img;
  };
  return null;
}

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
      className="aspect-video w-full rounded-[28px] border border-border/30 bg-background shadow-[0_28px_80px_rgba(0,27,84,0.22)]"
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
  drawHud(context, snapshot, width, height);
  drawFeedbackBurst(context, snapshot, width, height, now);

  if (snapshot.status === "countdown" && snapshot.countdown) {
    drawCountdown(context, snapshot.countdown, width, height);
  }

  if (snapshot.status === "finished") {
    drawFinalCard(context, snapshot, height, width);
  }
}

/**
 * Reads semantic CSS custom-properties from the document root so that all
 * canvas drawing automatically follows the active theme (light / dark).
 */
function getCanvasTokens() {
  const style =
    typeof window !== "undefined"
      ? getComputedStyle(document.documentElement)
      : null;
  const get = (v: string, fallback: string) =>
    style?.getPropertyValue(v).trim() || fallback;

  return {
    bg: get("--background", "oklch(0.985 0.006 162)"),
    fg: get("--foreground", "oklch(0.18 0.08 264)"),
    primary: get("--primary", "oklch(0.73 0.14 162)"),
    card: get("--card", "oklch(1 0 0)"),
  };
}

function drawBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
) {
  const { bg } = getCanvasTokens();
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, bg);
  gradient.addColorStop(0.5, bg);
  gradient.addColorStop(1, bg);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const { fg } = getCanvasTokens();
  // Subtle animated grid using foreground at low opacity
  context.fillStyle = fg.replace(")", " / 0.07)").replace("oklch(", "oklch(");
  // Fallback safe: use a semi-transparent foreground overlay
  context.globalAlpha = 0.07;
  context.fillStyle = fg;
  const offset = (now / 32) % 64;

  for (let x = -64; x < width + 64; x += 64) {
    context.fillRect(x + offset, 0, 2, height);
  }

  for (let y = -64; y < height + 64; y += 64) {
    context.fillRect(0, y + offset, width, 2);
  }

  context.globalAlpha = 1;
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
  const { fg, card, primary } = getCanvasTokens();
  const panelWidth = width * 0.48;
  const panelHeight = height * 0.44;
  const panelX = (width - panelWidth) / 2;
  const panelY = (height - panelHeight) / 2 - height * 0.02;
  context.fillStyle = card;
  context.globalAlpha = 0.58;
  roundRect(context, panelX, panelY, panelWidth, panelHeight, 42);
  context.fill();
  context.globalAlpha = 1;
  context.strokeStyle = primary;
  context.globalAlpha = 0.28;
  context.lineWidth = 4;
  context.stroke();
  context.globalAlpha = 1;

  context.fillStyle = fg;
  context.font = "700 46px sans-serif";
  context.textAlign = "center";
  context.fillText("Camera preview", width / 2, height / 2 - 20);
  context.font = "400 26px sans-serif";
  context.globalAlpha = 0.68;
  context.fillText(
    "Start camera to load body tracking",
    width / 2,
    height / 2 + 44,
  );
  context.globalAlpha = 1;
}

function drawPerspectiveGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  now: number,
) {
  const { primary } = getCanvasTokens();
  context.save();
  context.globalAlpha = 0.32;
  context.strokeStyle = primary;
  context.lineWidth = 2;
  const vanishingX = width / 2;
  const vanishingY = height * 0.58;

  for (let index = -9; index <= 9; index += 1) {
    context.beginPath();
    context.moveTo(vanishingX, vanishingY);
    context.lineTo(width / 2 + index * 165, height);
    context.stroke();
  }

  const pulse = (now / 18) % 110;

  for (let y = height * 0.68 + pulse; y < height; y += 78) {
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
  const { fg, primary } = getCanvasTokens();
  const time = Math.max(0, Math.ceil(snapshot.timeLeftMs / 1000));
  drawGlassPill(context, 38, 34, 214, 90, "TIME", `${time}s`);
  drawGlassPill(
    context,
    width - 274,
    34,
    236,
    90,
    "SCORE",
    `${snapshot.score}`,
  );

  drawLogo(context);

  drawGlassPanel(context, 42, height - 154, width - 84, 108, 28);
  context.textAlign = "left";
  context.fillStyle = fg;
  context.font = "800 30px sans-serif";
  context.fillText(snapshot.feedback, 72, height - 110);
  context.font = "600 25px sans-serif";
  context.globalAlpha = 0.72;
  context.fillText(
    `Combo ${snapshot.combo}   Walls ${snapshot.wallsPassed}/${snapshot.wallsAttempted}`,
    72,
    height - 78,
  );
  context.textAlign = "right";
  context.font = "600 30px sans-serif";
  context.fillText(
    `Alignment Rate: ${Math.round(snapshot.alignment)}%`,
    width - 72,
    height - 78,
  );
  context.globalAlpha = 1;

  const barX = 72;
  const barY = height - 62;
  const barWidth = width - 144;
  const progressRatio = Math.max(0, Math.min(100, snapshot.alignment)) / 100;
  context.globalAlpha = 0.14;
  context.fillStyle = fg;
  roundRect(context, barX, barY, barWidth, 14, 7);
  context.fill();
  context.globalAlpha = 1;
  const progress = context.createLinearGradient(
    barX,
    barY,
    barX + barWidth,
    barY,
  );
  progress.addColorStop(0, primary);
  progress.addColorStop(1, primary);
  context.fillStyle = progress;
  roundRect(context, barX, barY, barWidth * progressRatio, 14, 7);
  context.fill();
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
  const panelWidth = width * 0.42;
  const panelHeight = 116;
  const x = (width - panelWidth) / 2;
  const y = height * 0.16;

  context.save();
  context.globalAlpha = opacity;

  const bottomGlow = context.createLinearGradient(
    0,
    y - 72,
    0,
    y + panelHeight + 34,
  );
  bottomGlow.addColorStop(0, getFeedbackColor(burst.kind, 0));
  bottomGlow.addColorStop(0.5, getFeedbackColor(burst.kind, 0.18));
  bottomGlow.addColorStop(1, getFeedbackColor(burst.kind, 0));
  context.fillStyle = bottomGlow;
  context.fillRect(0, y - 72, width, panelHeight + 106);

  context.strokeStyle = getFeedbackColor(burst.kind, 0.82);
  context.lineWidth = 8;
  context.shadowColor = getFeedbackColor(burst.kind, 0.42);
  context.shadowBlur = 34;
  roundRect(context, 26, 26, width - 52, height - 52, 32);
  context.stroke();

  context.shadowBlur = 28;
  const { card } = getCanvasTokens();
  context.fillStyle = card;
  context.globalAlpha = 0.82;
  roundRect(context, x, y, panelWidth, panelHeight, 30);
  context.fill();
  context.globalAlpha = 1;
  context.shadowBlur = 0;
  context.strokeStyle = getFeedbackColor(burst.kind, 0.62);
  context.lineWidth = 3;
  context.stroke();

  context.textAlign = "center";
  context.font = "900 18px sans-serif";
  context.fillStyle = getFeedbackColor(burst.kind, 1);
  context.fillText(label, width / 2, y + 34);

  context.font = "900 30px sans-serif";
  const { fg } = getCanvasTokens();
  context.fillStyle = fg;
  context.fillText(
    truncateCanvasText(context, burst.message, panelWidth - 72),
    width / 2,
    y + 76,
  );

  context.font = "700 18px sans-serif";
  context.globalAlpha = 0.68;
  context.fillText(
    `${Math.round(burst.alignment)}% alignment`,
    width / 2,
    y + 108,
  );
  context.globalAlpha = 1;

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

function drawCountdown(
  context: CanvasRenderingContext2D,
  countdown: number,
  width: number,
  height: number,
) {
  const { fg, card, primary } = getCanvasTokens();
  const boxSize = Math.min(width, height) * 0.22;
  context.save();
  context.fillStyle = card;
  context.globalAlpha = 0.72;
  roundRect(
    context,
    width / 2 - boxSize / 2,
    height / 2 - boxSize / 2,
    boxSize,
    boxSize,
    44,
  );
  context.fill();
  context.globalAlpha = 1;
  context.strokeStyle = primary;
  context.globalAlpha = 0.62;
  context.lineWidth = 5;
  context.stroke();
  context.globalAlpha = 1;
  context.fillStyle = fg;
  context.textAlign = "center";
  context.font = "900 112px sans-serif";
  context.fillText(`${countdown}`, width / 2, height / 2 + 38);
  context.restore();
}

function drawFinalCard(
  context: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  height: number,
  width: number,
) {
  const { fg, primary } = getCanvasTokens();
  const cardWidth = width * 0.42;
  const cardHeight = height * 0.58;
  const x = (width - cardWidth) / 2;
  const y = (height - cardHeight) / 2;
  drawGlassPanel(context, x, y, cardWidth, cardHeight, 44);
  context.textAlign = "center";
  context.fillStyle = fg;
  context.font = "900 42px sans-serif";
  context.fillText("Your Score", width / 2, y + 84);
  context.font = "900 104px sans-serif";
  context.fillText(`${snapshot.score}`, width / 2, y + 206);

  context.font = "900 38px sans-serif";
  context.fillStyle = primary;
  context.fillText(snapshot.rank.toUpperCase(), width / 2, y + 286);

  context.font = "700 24px sans-serif";
  context.fillStyle = fg;
  context.globalAlpha = 0.78;
  context.fillText(
    `Walls Passed ${snapshot.wallsPassed}   Longest Combo ${snapshot.longestCombo}`,
    width / 2,
    y + 356,
  );
  context.fillText("Can your friends beat you?", width / 2, y + 408);
  context.globalAlpha = 1;
}

function drawLogo(context: CanvasRenderingContext2D) {
  const img = getLogoImage();

  if (!img) return;

  // Logo target region: upper-left, same area the RISE text occupied.
  // logo.png is 1270×952 (approx 4:3). We render it at 260×195 but crop
  // the excess vertical space — the actual mark sits in the top ~55% of
  // the image, so we draw a taller box and clip.
  const logoW = 280;
  const logoH = Math.round((img.naturalHeight / img.naturalWidth) * logoW);
  const logoX = 38;
  const logoY = 142;

  context.save();
  // 'multiply' makes white pixels transparent on light surfaces;
  // works well over both the glass panel and the video overlay.
  context.globalCompositeOperation = "multiply";
  context.drawImage(img, logoX, logoY, logoW, logoH);
  context.restore();
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
  const { fg } = getCanvasTokens();
  drawGlassPanel(context, x, y, width, height, 24);
  context.globalAlpha = 0.56;
  context.fillStyle = fg;
  context.font = "700 25px sans-serif";
  context.textAlign = "left";
  context.fillText(label, x + 28, y + 30);
  context.globalAlpha = 1;
  context.fillStyle = fg;
  context.font = "900 40px sans-serif";
  context.fillText(value, x + 28, y + 75);
}

function drawGlassPanel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const { card } = getCanvasTokens();
  context.save();
  context.fillStyle = card;
  context.globalAlpha = 0.66;
  roundRect(context, x, y, width, height, radius);
  context.fill();
  context.globalAlpha = 0.76;
  context.strokeStyle = card;
  context.lineWidth = 2;
  context.stroke();
  context.globalAlpha = 1;
  context.restore();
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
