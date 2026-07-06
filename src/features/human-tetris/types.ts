export type GameStatus =
  | "idle"
  | "loading"
  | "ready"
  | "countdown"
  | "playing"
  | "finished"
  | "error";

export type PoseId =
  | "idea"
  | "investorPitch"
  | "mvpTyping"
  | "networking"
  | "demoDay"
  | "fundingClosed"
  | "problemSolving"
  | "welcomeTeam"
  | "ceoMindset"
  | "scaleUp";

export type FounderRank =
  | "Intern"
  | "Hustler"
  | "Startup Founder"
  | "CEO"
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

export type DifficultyPhase = {
  label: string;
  startsAtMs: number;
  wallDurationMs: number;
  threshold: number;
  perfectThreshold: number;
  holeScale: number;
  rotationDeg: number;
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
  currentWall: BusinessWall;
  difficulty: DifficultyPhase;
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
