import type { BusinessWall, DifficultyPhase } from "./types";

export const GAME_DURATION_MS = 60_000;
export const COUNTDOWN_SECONDS = 3;
export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;

export const BUSINESS_WALLS: BusinessWall[] = [
  {
    id: 1,
    poseId: "idea",
    title: "I Have an Idea",
    theme: "Founder spark",
    category: "Leadership",
    cue: "Raise both hands above your head.",
  },
  {
    id: 2,
    poseId: "investorPitch",
    title: "Pitching Investors",
    theme: "Investor pitch",
    category: "Capital",
    cue: "Extend one arm like you are pitching forward.",
  },
  {
    id: 3,
    poseId: "mvpTyping",
    title: "Building MVP",
    theme: "AI builder",
    category: "Product",
    cue: "Hold both hands low and close like typing.",
  },
  {
    id: 4,
    poseId: "networking",
    title: "Networking",
    theme: "Handshake",
    category: "Community",
    cue: "Reach one hand toward the center.",
  },
  {
    id: 5,
    poseId: "demoDay",
    title: "Demo Day",
    theme: "One-hand presenting",
    category: "Public speaking",
    cue: "Present with one arm out.",
  },
  {
    id: 6,
    poseId: "fundingClosed",
    title: "Funding Closed",
    theme: "Victory pose",
    category: "Celebration",
    cue: "Raise both hands wide and high.",
  },
  {
    id: 7,
    poseId: "problemSolving",
    title: "Problem Solving",
    theme: "Thinking pose",
    category: "Decision making",
    cue: "Bring one hand near your chin.",
  },
  {
    id: 8,
    poseId: "welcomeTeam",
    title: "Welcome New Members",
    theme: "Open arms",
    category: "Teamwork",
    cue: "Open both arms wide.",
  },
  {
    id: 9,
    poseId: "ceoMindset",
    title: "CEO Mindset",
    theme: "Power stance",
    category: "Founder",
    cue: "Put both hands near your hips.",
  },
  {
    id: 10,
    poseId: "scaleUp",
    title: "Scale Up",
    theme: "Rocket launch",
    category: "Growth",
    cue: "Point one hand high like a launch.",
  },
];

export const DIFFICULTY_PHASES: DifficultyPhase[] = [
  {
    label: "Seed",
    startsAtMs: 0,
    wallDurationMs: 3200,
    threshold: 0.58,
    perfectThreshold: 0.84,
    holeScale: 1.16,
    rotationDeg: 0,
  },
  {
    label: "Series A",
    startsAtMs: 15_000,
    wallDurationMs: 2600,
    threshold: 0.64,
    perfectThreshold: 0.88,
    holeScale: 1.02,
    rotationDeg: 2,
  },
  {
    label: "Scale",
    startsAtMs: 30_000,
    wallDurationMs: 2100,
    threshold: 0.7,
    perfectThreshold: 0.9,
    holeScale: 0.94,
    rotationDeg: -3,
  },
  {
    label: "Unicorn",
    startsAtMs: 45_000,
    wallDurationMs: 1700,
    threshold: 0.74,
    perfectThreshold: 0.92,
    holeScale: 0.86,
    rotationDeg: 5,
  },
];

export const SUCCESS_FEEDBACK = [
  "Perfect",
  "Awesome",
  "Great Pitch",
  "Investor Approved",
  "Startup Energy",
];

export const SOCIAL_HASHTAGS = [
  "#HumanTetris",
  "#FounderChallenge",
  "#StartupPose",
  "#CEOChallenge",
  "#BusinessMoves",
  "#RiseChallenge",
  "#EntrepreneurLife",
  "#AIChallenge",
];

export function getDifficulty(elapsedMs: number) {
  for (let index = DIFFICULTY_PHASES.length - 1; index >= 0; index -= 1) {
    const phase = DIFFICULTY_PHASES[index];

    if (elapsedMs >= phase.startsAtMs) {
      return phase;
    }
  }

  return DIFFICULTY_PHASES[0];
}

export function getWallByIndex(index: number) {
  return BUSINESS_WALLS[index % BUSINESS_WALLS.length];
}
