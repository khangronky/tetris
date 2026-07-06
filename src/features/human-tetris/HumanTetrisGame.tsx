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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { CompositorCanvas } from "./CompositorCanvas";
import {
  COUNTDOWN_SECONDS,
  GAME_DURATION_MS,
  getDifficulty,
  getWallByIndex,
  SOCIAL_HASHTAGS,
  SUCCESS_FEEDBACK,
} from "./game-data";
import { useGameStore } from "./game-store";
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
  const timeLeftMs = useGameStore((state) => state.timeLeftMs);
  const elapsedMs = useGameStore((state) => state.elapsedMs);
  const countdown = useGameStore((state) => state.countdown);
  const alignment = useGameStore((state) => state.alignment);
  const distance = useGameStore((state) => state.distance);
  const feedback = useGameStore((state) => state.feedback);
  const feedbackBurst = useGameStore((state) => state.feedbackBurst);
  const currentWall = useMemo(
    () => getWallByIndex(currentWallIndex),
    [currentWallIndex],
  );
  const difficulty = useMemo(() => getDifficulty(elapsedMs), [elapsedMs]);
  const rank = useMemo(() => getFounderRank(score), [score]);
  const snapshot = useMemo<GameSnapshot>(
    () => ({
      status,
      currentWall,
      difficulty,
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
      difficulty,
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
  const progressValue = Math.round(
    ((GAME_DURATION_MS - snapshot.timeLeftMs) / GAME_DURATION_MS) * 100,
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
        toast.success("Founder recording is ready.");
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
      const difficulty = getDifficulty(elapsedMs);
      const wall = getWallByIndex(state.currentWallIndex);
      const wallElapsed = now - wallStartTimeRef.current;
      const distance = Math.max(0, 1 - wallElapsed / difficulty.wallDurationMs);

      if (
        videoRef.current &&
        engineRef.current &&
        now - detectionTimeRef.current > 90
      ) {
        detectionTimeRef.current = now;
        latestPoseRef.current = engineRef.current.detect(videoRef.current, now);
      }

      const match = matchPose(wall, latestPoseRef.current, difficulty);

      if (now - storeTickTimeRef.current > 90) {
        storeTickTimeRef.current = now;
        state.setTick({
          elapsedMs,
          timeLeftMs,
          alignment: match.score,
          distance,
        });
      }

      if (wallElapsed >= difficulty.wallDurationMs) {
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
          width: { ideal: 720 },
          height: { ideal: 1280 },
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
      <div className="rise-glow rise-glow-a" />
      <div className="rise-glow rise-glow-b" />

      <section className="relative mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 items-center gap-5 px-4 py-5 lg:grid-cols-[340px_minmax(320px,500px)_340px] lg:px-6">
        <motion.aside
          className="order-2 flex flex-col gap-4 lg:order-1"
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
        >
          <Card className="rise-card" size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SparklesIcon className="size-4 text-primary" />
                Human Tetris
              </CardTitle>
              <CardDescription>
                Founder Edition turns business moves into 60 seconds of body
                tracking.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">RISE</Badge>
                <Badge variant="outline">9:16 recording</Badge>
                <Badge variant="outline">No audio v1</Badge>
              </div>
              <div className="rounded-lg bg-secondary/70 p-3 text-sm text-muted-foreground">
                Match each incoming business wall before it reaches you. The
                recording is generated at the end for TikTok, Reels, or Shorts.
              </div>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
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

          <Card className="rise-card" size="sm">
            <CardHeader>
              <CardTitle>Current Wall</CardTitle>
              <CardDescription>
                {snapshot.difficulty.label} phase
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div>
                <p className="text-xl font-semibold">
                  {snapshot.currentWall.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {snapshot.currentWall.cue}
                </p>
              </div>
              <Progress value={progressValue} />
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Metric
                  label="Timer"
                  value={`${Math.ceil(snapshot.timeLeftMs / 1000)}s`}
                />
                <Metric
                  label="Align"
                  value={`${Math.round(snapshot.alignment * 100)}%`}
                />
              </div>
            </CardContent>
          </Card>
        </motion.aside>

        <motion.section
          className="order-1 flex justify-center lg:order-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative w-full max-w-110">
            <div className="absolute -inset-3 rounded-[36px] bg-primary/15 blur-2xl" />
            <div className="relative rounded-[34px] border border-white/30 bg-white/35 p-2 shadow-2xl backdrop-blur-xl">
              <CompositorCanvas
                ref={canvasRef}
                videoRef={videoRef}
                snapshot={snapshot}
              />
              {feedbackBurst ? (
                <div
                  key={feedbackBurst.id}
                  data-feedback-kind={feedbackBurst.kind}
                  className="rise-feedback-flash pointer-events-none absolute inset-0 rounded-[34px]"
                />
              ) : null}
              <video ref={videoRef} className="sr-only" muted playsInline />
            </div>
          </div>
        </motion.section>

        <motion.aside
          className="order-3 flex flex-col gap-4"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
        >
          <Card className="rise-card" size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrophyIcon className="size-4 text-primary" />
                Founder Score
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
                <Metric label="Accuracy" value={`${finalStats.accuracy}%`} />
                <Metric label="Rank" value={finalStats.rank} />
              </div>
            </CardContent>
          </Card>

          {status === "error" ? (
            <Card className="rise-card border-destructive/30" size="sm">
              <CardHeader>
                <CardTitle>Camera Error</CardTitle>
                <CardDescription>{error}</CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {status === "finished" ? (
            <Card className="rise-card" size="sm">
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
                  <p className="text-sm text-muted-foreground">Founder Score</p>
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
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/40 bg-white/50 p-3 backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
