import { create } from "zustand";

import { BUSINESS_WALLS, getDifficulty, getWallByIndex } from "./game-data";
import { getAccuracy, getFounderRank } from "./score";
import type {
  DifficultyPhase,
  FeedbackBurst,
  GameSnapshot,
  GameStatus,
  RecordingResult,
  WallResult,
} from "./types";

type GameStore = {
  status: GameStatus;
  error: string | null;
  score: number;
  combo: number;
  longestCombo: number;
  wallsPassed: number;
  wallsAttempted: number;
  currentWallIndex: number;
  timeLeftMs: number;
  elapsedMs: number;
  countdown: number | null;
  alignment: number;
  distance: number;
  feedback: string;
  feedbackBurst: FeedbackBurst | null;
  recording: RecordingResult | null;
  setStatus: (status: GameStatus) => void;
  setError: (error: string) => void;
  setReady: () => void;
  setCountdown: (countdown: number | null) => void;
  setPlaying: () => void;
  resetRun: () => void;
  resetToReady: () => void;
  setTick: (tick: {
    elapsedMs: number;
    timeLeftMs: number;
    alignment: number;
    distance: number;
  }) => void;
  advanceWall: () => void;
  applyWallResult: (result: WallResult) => void;
  finishRun: (bonusPoints: number) => void;
  setRecording: (recording: RecordingResult | null) => void;
  getSnapshot: () => GameSnapshot;
};

const INITIAL_STATE = {
  status: "idle" as GameStatus,
  error: null,
  score: 0,
  combo: 0,
  longestCombo: 0,
  wallsPassed: 0,
  wallsAttempted: 0,
  currentWallIndex: 0,
  timeLeftMs: 60_000,
  elapsedMs: 0,
  countdown: null,
  alignment: 0,
  distance: 1,
  feedback: "Start camera to enter the founder wall run",
  feedbackBurst: null,
  recording: null,
};

const FEEDBACK_HOLD_MS = 650;
const FEEDBACK_FADE_MS = 750;

export const useGameStore = create<GameStore>((set, get) => ({
  ...INITIAL_STATE,

  setStatus(status) {
    set({ status, error: null });
  },

  setError(error) {
    set({ status: "error", error });
  },

  setReady() {
    set({
      ...INITIAL_STATE,
      status: "ready",
      feedback: "Camera ready. Begin the 60-second challenge.",
    });
  },

  setCountdown(countdown) {
    set({
      status: "countdown",
      countdown,
      feedback: countdown ? "Find your starting stance" : "Launch",
    });
  },

  setPlaying() {
    set({
      ...INITIAL_STATE,
      status: "playing",
      feedback: "Match the incoming business wall.",
    });
  },

  resetRun() {
    set(INITIAL_STATE);
  },

  resetToReady() {
    set({
      ...INITIAL_STATE,
      status: "ready",
      feedback: "Ready for another founder run.",
    });
  },

  setTick(tick) {
    set({
      elapsedMs: tick.elapsedMs,
      timeLeftMs: tick.timeLeftMs,
      alignment: tick.alignment,
      distance: tick.distance,
    });
  },

  advanceWall() {
    set((state) => ({
      currentWallIndex: state.currentWallIndex + 1,
      distance: 1,
    }));
  },

  applyWallResult(result) {
    set((state) => {
      const nextCombo = result.passed ? state.combo + 1 : 0;
      const nextWallsPassed = result.passed
        ? state.wallsPassed + 1
        : state.wallsPassed;
      const feedbackBurst: FeedbackBurst = {
        id: state.wallsAttempted + 1,
        kind: result.passed ? "success" : "fail",
        message: result.feedback,
        alignment: result.alignment,
        startedAtMs: globalThis.performance?.now() ?? Date.now(),
        holdMs: FEEDBACK_HOLD_MS,
        fadeMs: FEEDBACK_FADE_MS,
      };

      return {
        score: state.score + result.points,
        combo: nextCombo,
        longestCombo: Math.max(state.longestCombo, nextCombo),
        wallsPassed: nextWallsPassed,
        wallsAttempted: state.wallsAttempted + 1,
        alignment: result.alignment,
        feedback: result.feedback,
        feedbackBurst,
      };
    });
  },

  finishRun(bonusPoints) {
    set((state) => ({
      status: "finished",
      score: state.score + bonusPoints,
      combo: 0,
      feedbackBurst: null,
      feedback:
        bonusPoints > 0
          ? "No-miss bonus secured"
          : "Run complete. Recording is being prepared.",
    }));
  },

  setRecording(recording) {
    set({ recording });
  },

  getSnapshot() {
    const state = get();
    const difficulty: DifficultyPhase = getDifficulty(state.elapsedMs);

    return {
      status: state.status,
      currentWall: getWallByIndex(state.currentWallIndex),
      difficulty,
      timeLeftMs: state.timeLeftMs,
      score: state.score,
      combo: state.combo,
      longestCombo: state.longestCombo,
      wallsPassed: state.wallsPassed,
      wallsAttempted: state.wallsAttempted,
      alignment: state.alignment,
      feedback: state.feedback,
      feedbackBurst: state.feedbackBurst,
      distance: state.distance,
      countdown: state.countdown,
      rank: getFounderRank(state.score),
    };
  },
}));

export function getFinalStats() {
  const state = useGameStore.getState();

  return {
    score: state.score,
    wallsPassed: state.wallsPassed,
    wallsAttempted: state.wallsAttempted,
    longestCombo: state.longestCombo,
    accuracy: getAccuracy({
      wallsAttempted: state.wallsAttempted,
      wallsPassed: state.wallsPassed,
    }),
    rank: getFounderRank(state.score),
    allWalls: BUSINESS_WALLS.length,
  };
}
