import type { BusinessWall } from "./types";

export const GAME_DURATION_MS = 60_000;
export const COUNTDOWN_SECONDS = 3;
export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;
// Increase the wall approach duration so players have more time to match each pose.
export const WALL_APPROACH_DURATION_MS = 8_000;
export const MATCH_THRESHOLD = 70;
export const PERFECT_THRESHOLD = 90;

export const BUSINESS_WALLS: BusinessWall[] = [
  {
    id: 1,
    poseId: "I_HAVE_AN_IDEA",
    title: "I Have an Idea",
    theme: "Founder spark",
    category: "Leadership",
    cue: "Raise both hands above your head.",
  },
  {
    id: 2,
    poseId: "PITCHING_INVESTORS",
    title: "Pitching Investors",
    theme: "Investor pitch",
    category: "Capital",
    cue: "Extend one arm like you are pitching forward.",
  },
  {
    id: 3,
    poseId: "BUILDING_MVP",
    title: "Building MVP",
    theme: "AI builder",
    category: "Product",
    cue: "Hold both hands low and close like typing.",
  },
  {
    id: 4,
    poseId: "NETWORKING",
    title: "Networking",
    theme: "Handshake",
    category: "Community",
    cue: "Reach one hand toward the center.",
  },
  {
    id: 5,
    poseId: "DEMO_DAY",
    title: "Demo Day",
    theme: "One-hand presenting",
    category: "Public speaking",
    cue: "Present with one arm out.",
  },
  {
    id: 6,
    poseId: "VICTORY_POSE",
    title: "Funding Closed",
    theme: "Victory pose",
    category: "Celebration",
    cue: "Raise both hands wide and high.",
  },
  {
    id: 7,
    poseId: "PROBLEM_SOLVING",
    title: "Problem Solving",
    theme: "Thinking pose",
    category: "Decision making",
    cue: "Bring one hand near your chin.",
  },
  {
    id: 8,
    poseId: "WELCOME_MEMBERS",
    title: "Welcome New Members",
    theme: "Open arms",
    category: "Teamwork",
    cue: "Open both arms wide.",
  },
  {
    id: 9,
    poseId: "CEO_MINDSET",
    title: "CEO Mindset",
    theme: "Power stance",
    category: "Founder",
    cue: "Put both hands near your hips.",
  },
  {
    id: 10,
    poseId: "SCALE_UP",
    title: "Scale Up",
    theme: "Rocket launch",
    category: "Growth",
    cue: "Point one hand high like a launch.",
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

export function getWallByIndex(index: number) {
  return BUSINESS_WALLS[index % BUSINESS_WALLS.length];
}
