import { create } from "zustand";

import { BUSINESS_WALLS, getWallByIndex } from "./game-data";
import { getAccuracy, getFounderRank } from "./score";
import type {
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
  currentWallIndex: number | null;
  usedWallIndexes: number[];
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

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function pickRandomWallIndex(excludedIndexes: readonly number[] = []) {
  const availableIndexes = BUSINESS_WALLS.map((_, index) => index).filter(
    (index) => !excludedIndexes.includes(index),
  );

  if (availableIndexes.length === 0) {
    return 0;
  }

  return availableIndexes[randomInt(availableIndexes.length)];
}

function getNextWallIndex({
  previousWallIndex,
  usedWallIndexes,
}: {
  previousWallIndex: number;
  usedWallIndexes: readonly number[];
}) {
  const remainingIndexes = BUSINESS_WALLS.map((_, index) => index).filter(
    (index) => !usedWallIndexes.includes(index),
  );

  const pool =
    remainingIndexes.length > 0
      ? remainingIndexes
      : BUSINESS_WALLS.map((_, index) => index).filter(
          (index) => index !== previousWallIndex,
        );

  if (pool.length === 0) {
    return previousWallIndex;
  }

  return pool[randomInt(pool.length)];
}

const INITIAL_STATE = {
  status: "idle" as GameStatus,
  error: null,
  score: 0,
  combo: 0,
  longestCombo: 0,
  wallsPassed: 0,
  wallsAttempted: 0,
  currentWallIndex: null as number | null,
  usedWallIndexes: [] as number[],
  timeLeftMs: 60_000,
  elapsedMs: 0,
  countdown: null,
  alignment: 0,
  distance: 1,
  feedback: "Start camera to enter the wall run",
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
    const currentWallIndex = pickRandomWallIndex();

    set({
      ...INITIAL_STATE,
      status: "playing",
      currentWallIndex,
      usedWallIndexes: [currentWallIndex],
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
      feedback: "Ready for another wall run.",
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
    set((state) => {
      if (state.currentWallIndex === null) {
        return state;
      }

      const currentWallIndex = getNextWallIndex({
        previousWallIndex: state.currentWallIndex,
        usedWallIndexes: state.usedWallIndexes,
      });
      const hasUsedAllWalls =
        state.usedWallIndexes.length >= BUSINESS_WALLS.length;

      return {
        currentWallIndex,
        usedWallIndexes: hasUsedAllWalls
          ? [currentWallIndex]
          : [...state.usedWallIndexes, currentWallIndex],
        distance: 1,
      };
    });
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
      currentWallIndex: null,
      usedWallIndexes: [],
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

    return {
      status: state.status,
      currentWall:
        state.currentWallIndex === null
          ? null
          : getWallByIndex(state.currentWallIndex),
      usedWallIndexes: state.usedWallIndexes,
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
