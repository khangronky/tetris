"use client";

import {
  CameraIcon,
  DownloadIcon,
  PlayIcon,
  RotateCcwIcon,
  Share2Icon,
  SparklesIcon,
  TrophyIcon,
  VideoIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CompositorCanvas } from "./CompositorCanvas";
import {
  COUNTDOWN_SECONDS,
  GAME_DURATION_MS,
  getWallByIndex,
  SOCIAL_HASHTAGS,
  SUCCESS_FEEDBACK,
  WALL_APPROACH_DURATION_MS,
} from "./game-data";
import { useGameStore } from "./game-store";
import { PoseWallCard } from "./PoseWallCard";
import { createPoseEngine, type PoseEngine } from "./pose-engine";
import { matchPose } from "./pose-matchers";
import {
  type ActiveRecording,
  downloadRecording,
  isRecordingSupported,
  shareRecording,
  startCanvasRecording,
} from "./recording";
import {
  getAccuracy,
  getFounderRank,
  getNoMissBonus,
  scoreWall,
} from "./score";
import type { GameSnapshot, PoseFrame } from "./types";

const glassCardClassName =
  "border-white/40 bg-white/55 shadow-[0_18px_60px_rgba(4,36,93,0.12)] backdrop-blur-xl";

export function HumanTetrisGame() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const engineRef = useRef<PoseEngine | null>(null);
  const recordingRef = useRef<ActiveRecording | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const wallStartTimeRef = useRef(0);
  const detectionTimeRef = useRef(0);
  const storeTickTimeRef = useRef(0);
  const latestPoseRef = useRef<PoseFrame | null>(null);
  const finishingRef = useRef(false);

  const status = useGameStore((state) => state.status);
  const error = useGameStore((state) => state.error);
  const recording = useGameStore((state) => state.recording);
  const score = useGameStore((state) => state.score);
  const combo = useGameStore((state) => state.combo);
  const wallsPassed = useGameStore((state) => state.wallsPassed);
  const wallsAttempted = useGameStore((state) => state.wallsAttempted);
  const longestCombo = useGameStore((state) => state.longestCombo);
  const currentWallIndex = useGameStore((state) => state.currentWallIndex);
  const usedWallIndexes = useGameStore((state) => state.usedWallIndexes);
  const timeLeftMs = useGameStore((state) => state.timeLeftMs);
  const countdown = useGameStore((state) => state.countdown);
  const alignment = useGameStore((state) => state.alignment);
  const distance = useGameStore((state) => state.distance);
  const feedback = useGameStore((state) => state.feedback);
  const feedbackBurst = useGameStore((state) => state.feedbackBurst);
  const currentWall = useMemo(
    () => (currentWallIndex === null ? null : getWallByIndex(currentWallIndex)),
    [currentWallIndex],
  );
  const rank = useMemo(() => getFounderRank(score), [score]);
  const snapshot = useMemo<GameSnapshot>(
    () => ({
      status,
      currentWall,
      usedWallIndexes,
      timeLeftMs,
      score,
      combo,
      longestCombo,
      wallsPassed,
      wallsAttempted,
      alignment,
      feedback,
      feedbackBurst,
      distance,
      countdown,
      rank,
    }),
    [
      status,
      currentWall,
      usedWallIndexes,
      timeLeftMs,
      score,
      combo,
      longestCombo,
      wallsPassed,
      wallsAttempted,
      alignment,
      feedback,
      feedbackBurst,
      distance,
      countdown,
      rank,
    ],
  );
  const finalStats = useMemo(
    () => ({
      score,
      wallsPassed,
      wallsAttempted,
      longestCombo,
      accuracy: getAccuracy({ wallsAttempted, wallsPassed }),
      rank,
    }),
    [longestCombo, rank, score, wallsAttempted, wallsPassed],
  );

  const cleanupRecordingUrl = useCallback(() => {
    const currentRecording = useGameStore.getState().recording;

    if (currentRecording) {
      URL.revokeObjectURL(currentRecording.url);
      useGameStore.getState().setRecording(null);
    }
  }, []);

  const stopLoop = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const finishGame = useCallback(async () => {
    if (finishingRef.current) {
      return;
    }

    finishingRef.current = true;
    stopLoop();

    const state = useGameStore.getState();
    const bonusPoints = getNoMissBonus({
      wallsAttempted: state.wallsAttempted,
      wallsPassed: state.wallsPassed,
    });
    state.finishRun(bonusPoints);

    if (recordingRef.current) {
      try {
        const result = await recordingRef.current.stop();
        useGameStore.getState().setRecording(result);
        toast.success("Your recording is ready.");
      } catch (recordingError) {
        toast.warning(
          recordingError instanceof Error
            ? recordingError.message
            : "Recording could not be prepared.",
        );
      } finally {
        recordingRef.current = null;
      }
    }
  }, [stopLoop]);

  const runGameFrame = useCallback(
    (now: number) => {
      const state = useGameStore.getState();

      if (state.status !== "playing") {
        return;
      }

      const elapsedMs = now - startTimeRef.current;
      const timeLeftMs = Math.max(0, GAME_DURATION_MS - elapsedMs);
      if (state.currentWallIndex === null) {
        return;
      }

      const wall = getWallByIndex(state.currentWallIndex);
      const wallElapsed = now - wallStartTimeRef.current;
      const distance = Math.max(0, 1 - wallElapsed / WALL_APPROACH_DURATION_MS);

      if (
        videoRef.current &&
        engineRef.current &&
        now - detectionTimeRef.current > 90
      ) {
        detectionTimeRef.current = now;
        latestPoseRef.current = engineRef.current.detect(videoRef.current, now);
      }

      const match = matchPose(wall, latestPoseRef.current);

      if (now - storeTickTimeRef.current > 90) {
        storeTickTimeRef.current = now;
        state.setTick({
          elapsedMs,
          timeLeftMs,
          alignment: match.score,
          distance,
        });
      }

      if (wallElapsed >= WALL_APPROACH_DURATION_MS) {
        const latestState = useGameStore.getState();
        const nextCombo = match.passed ? latestState.combo + 1 : 0;
        const points = match.passed
          ? scoreWall({ perfect: match.perfect, combo: nextCombo })
          : 0;
        const feedback = match.passed
          ? SUCCESS_FEEDBACK[latestState.wallsPassed % SUCCESS_FEEDBACK.length]
          : match.label;

        latestState.applyWallResult({
          passed: match.passed,
          perfect: match.perfect,
          alignment: match.score,
          feedback,
          points,
        });
        latestState.advanceWall();
        wallStartTimeRef.current = now;
      }

      if (timeLeftMs <= 0) {
        void finishGame();
        return;
      }

      animationFrameRef.current = requestAnimationFrame(runGameFrame);
    },
    [finishGame],
  );

  const startCamera = useCallback(async () => {
    cleanupRecordingUrl();

    if (!navigator.mediaDevices?.getUserMedia) {
      useGameStore
        .getState()
        .setError("This browser does not support camera capture.");
      return;
    }

    useGameStore.getState().setStatus("loading");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      const engine = await createPoseEngine().catch((engineError: unknown) => {
        for (const track of stream.getTracks()) {
          track.stop();
        }

        throw engineError;
      });

      streamRef.current = stream;
      engineRef.current = engine;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      useGameStore.getState().setReady();
      toast.success("Camera and pose tracking are ready.");
    } catch (cameraError) {
      useGameStore
        .getState()
        .setError(
          cameraError instanceof Error
            ? cameraError.message
            : "Camera or pose tracking failed to start.",
        );
    }
  }, [cleanupRecordingUrl]);

  const startCountdown = useCallback(() => {
    cleanupRecordingUrl();
    stopLoop();
    finishingRef.current = false;
    latestPoseRef.current = null;
    useGameStore.getState().setCountdown(COUNTDOWN_SECONDS);

    let nextCount = COUNTDOWN_SECONDS;
    const interval = window.setInterval(() => {
      nextCount -= 1;

      if (nextCount <= 0) {
        window.clearInterval(interval);
        const canvas = canvasRef.current;

        useGameStore.getState().setPlaying();
        startTimeRef.current = performance.now();
        wallStartTimeRef.current = startTimeRef.current;
        detectionTimeRef.current = 0;
        storeTickTimeRef.current = 0;

        if (canvas && isRecordingSupported()) {
          try {
            recordingRef.current = startCanvasRecording(canvas);
          } catch {
            recordingRef.current = null;
            toast.warning("Recording is not available in this browser.");
          }
        } else {
          toast.warning("Recording is not available in this browser.");
        }

        animationFrameRef.current = requestAnimationFrame(runGameFrame);
        return;
      }

      useGameStore.getState().setCountdown(nextCount);
    }, 1000);
  }, [cleanupRecordingUrl, runGameFrame, stopLoop]);

  const resetForReplay = useCallback(() => {
    cleanupRecordingUrl();
    recordingRef.current?.cancel();
    recordingRef.current = null;
    stopLoop();
    latestPoseRef.current = null;
    finishingRef.current = false;
    useGameStore.getState().resetToReady();
  }, [cleanupRecordingUrl, stopLoop]);

  const stopCamera = useCallback(() => {
    cleanupRecordingUrl();
    recordingRef.current?.cancel();
    recordingRef.current = null;
    stopLoop();
    engineRef.current?.close();
    engineRef.current = null;

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    useGameStore.getState().resetRun();
  }, [cleanupRecordingUrl, stopLoop]);

  const handleDownload = useCallback(() => {
    if (recording) {
      downloadRecording(recording);
    }
  }, [recording]);

  const handleShare = useCallback(async () => {
    if (!recording) {
      return;
    }

    const shared = await shareRecording(recording);

    if (!shared) {
      downloadRecording(recording);
      toast.info("Sharing is unavailable here, so the video was downloaded.");
    }
  }, [recording]);

  useEffect(() => stopCamera, [stopCamera]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="rise-grid absolute inset-0" />
      <div className="pointer-events-none absolute left-[4%] top-[9%] size-72 rounded-full bg-primary/18 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[10%] right-[5%] size-96 rounded-full bg-cyan-300/18 blur-3xl" />

      <section className="relative mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8">
        <motion.header
          className="mx-auto mb-8 max-w-5xl text-center"
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-white/65 px-4 py-1.5 text-sm font-semibold text-primary shadow-[0_10px_30px_rgba(4,36,93,0.08)] backdrop-blur-xl">
            <SparklesIcon className="size-4" />
            Human Tetris
          </div>
          <h1 className="mt-4 text-balance text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
            Match the wall. Share the run.
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            Human Tetris turns founder energy into a live body-tracking game.
            Step in, mirror each incoming business pose, and finish with a
            shareable challenge clip.
          </p>
        </motion.header>

        <div className="flex min-h-[calc(100vh-17rem)] items-center">
          <div className="grid w-full gap-6 lg:grid-cols-3">
            <motion.section
              className="lg:col-span-2 flex flex-col gap-5"
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45 }}
            >
              <div className="relative flex min-w-0 items-center justify-center">
                <div className="absolute -inset-4 rounded-[40px] bg-primary/16 blur-3xl" />
                <div className="relative w-full rounded-[34px] border border-white/55 bg-white/35 p-2.5 shadow-[0_28px_120px_rgba(0,73,121,0.22)] backdrop-blur-xl">
                  <CompositorCanvas
                    ref={canvasRef}
                    videoRef={videoRef}
                    snapshot={snapshot}
                  />
                  {feedbackBurst ? (
                    <div
                      key={feedbackBurst.id}
                      data-feedback-kind={feedbackBurst.kind}
                      className="rise-feedback-flash pointer-events-none absolute inset-2.5 rounded-[30px]"
                    />
                  ) : null}
                  <video ref={videoRef} className="sr-only" muted playsInline />
                </div>
              </div>

              <Card className={glassCardClassName} size="sm">
                <CardFooter className="border-t-0 bg-transparent pt-0 flex flex-wrap gap-2">
                  {status === "idle" || status === "error" ? (
                    <Button onClick={startCamera}>
                      <CameraIcon data-icon="inline-start" />
                      Start camera
                    </Button>
                  ) : null}
                  {status === "loading" ? (
                    <Button disabled>
                      <CameraIcon data-icon="inline-start" />
                      Loading camera
                    </Button>
                  ) : null}
                  {status === "ready" ? (
                    <Button onClick={startCountdown}>
                      <PlayIcon data-icon="inline-start" />
                      Begin run
                    </Button>
                  ) : null}
                  {status === "finished" ? (
                    <Button onClick={resetForReplay}>
                      <RotateCcwIcon data-icon="inline-start" />
                      Replay
                    </Button>
                  ) : null}
                  {status !== "idle" ? (
                    <Button variant="ghost" onClick={stopCamera}>
                      Stop camera
                    </Button>
                  ) : null}
                </CardFooter>
              </Card>
            </motion.section>

            <motion.aside
              className="lg:col-span-1 flex flex-col gap-5"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45 }}
            >
              <PoseWallCard snapshot={snapshot} />

              <Card className={glassCardClassName} size="sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrophyIcon className="size-4 text-primary" />
                    Your Score
                  </CardTitle>
                  <CardDescription>{snapshot.rank}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-5xl font-black tracking-tight">{score}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Metric
                      label="Walls"
                      value={`${wallsPassed}/${wallsAttempted}`}
                    />
                    <Metric label="Best combo" value={`${longestCombo}`} />
                    <Metric
                      label="Accuracy"
                      value={`${finalStats.accuracy}%`}
                    />
                    <Metric label="Rank" value={finalStats.rank} />
                  </div>
                </CardContent>
              </Card>

              {status === "error" ? (
                <Card
                  className="border-destructive/30 bg-white/55 shadow-[0_18px_60px_rgba(4,36,93,0.12)] backdrop-blur-xl"
                  size="sm"
                >
                  <CardHeader>
                    <CardTitle>Camera Error</CardTitle>
                    <CardDescription>{error}</CardDescription>
                  </CardHeader>
                </Card>
              ) : null}

              {status === "finished" ? (
                <Card className={glassCardClassName} size="sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <VideoIcon className="size-4 text-primary" />
                      Share Card
                    </CardTitle>
                    <CardDescription>
                      Recording is {recording ? "ready" : "being prepared"}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="rounded-lg bg-secondary/70 p-3">
                      <p className="text-sm text-muted-foreground">
                        Your Score
                      </p>
                      <p className="text-3xl font-black">{finalStats.score}</p>
                      <p className="mt-2 text-sm font-medium">
                        {SOCIAL_HASHTAGS.slice(0, 4).join(" ")}
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-wrap gap-2">
                    <Button disabled={!recording} onClick={handleShare}>
                      <Share2Icon data-icon="inline-start" />
                      Share
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!recording}
                      onClick={handleDownload}
                    >
                      <DownloadIcon data-icon="inline-start" />
                      Save
                    </Button>
                  </CardFooter>
                </Card>
              ) : null}
            </motion.aside>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 p-3 backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
