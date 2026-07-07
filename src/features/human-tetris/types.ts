import type { PoseId } from "./target-poses";

export type GameStatus =
  | "idle"
  | "loading"
  | "ready"
  | "countdown"
  | "playing"
  | "finished"
  | "error";

export type FounderRank =
  | "Apprentice"
  | "Solopreneur"
  | "Startup Founder"
  | "Visionary CEO"
  | "Unicorn Builder"
  | "Future Billionaire";

export type BusinessWall = {
  id: number;
  poseId: PoseId;
  title: string;
  theme: string;
  category: string;
  cue: string;
};

export type PoseLandmark = {
  x: number;
  y: number;
  z: number;
  visibility: number;
  presence?: number;
};

export type PoseDetection = {
  index: number;
  landmarks: PoseLandmark[];
  worldLandmarks: PoseLandmark[];
  confidence: number;
};

export type PoseFrame = {
  poses: PoseDetection[];
  detectedAtMs: number;
  width: number;
  height: number;
};

export type PoseMatchResult = {
  score: number;
  passed: boolean;
  perfect: boolean;
  label: string;
};

export type WallResult = {
  passed: boolean;
  perfect: boolean;
  alignment: number;
  feedback: string;
  points: number;
};

export type FeedbackBurst = {
  id: number;
  kind: "success" | "fail";
  message: string;
  alignment: number;
  startedAtMs: number;
  holdMs: number;
  fadeMs: number;
};

export type RecordingResult = {
  blob: Blob;
  url: string;
  mimeType: string;
  fileName: string;
};

export type GameSnapshot = {
  status: GameStatus;
  currentWall: BusinessWall | null;
  usedWallIndexes: number[];
  timeLeftMs: number;
  score: number;
  combo: number;
  longestCombo: number;
  wallsPassed: number;
  wallsAttempted: number;
  alignment: number;
  feedback: string;
  feedbackBurst: FeedbackBurst | null;
  distance: number;
  countdown: number | null;
  rank: FounderRank;
};
