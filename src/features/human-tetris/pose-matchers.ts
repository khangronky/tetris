import { MATCH_THRESHOLD, PERFECT_THRESHOLD } from "./game-data";
import {
  createComparablePose,
  LANDMARKS_PER_POSE,
  type LandmarkLike,
  TARGET_POSES,
} from "./target-poses";
import type {
  BusinessWall,
  PoseDetection,
  PoseFrame,
  PoseMatchResult,
} from "./types";

const NO_MATCH: PoseMatchResult = {
  score: 0,
  passed: false,
  perfect: false,
  label: "No body detected",
};
const DEFAULT_LANDMARK_SCORE_CONFIG = {
  weight: 0.35,
  tolerance: 0.72,
};
const LANDMARK_SCORE_CONFIG: Partial<
  Record<number, { weight: number; tolerance: number }>
> = {
  0: { weight: 0.6, tolerance: 0.52 },
  11: { weight: 1.4, tolerance: 0.24 },
  12: { weight: 1.4, tolerance: 0.24 },
  13: { weight: 1.8, tolerance: 0.3 },
  14: { weight: 1.8, tolerance: 0.3 },
  15: { weight: 2, tolerance: 0.36 },
  16: { weight: 2, tolerance: 0.36 },
  23: { weight: 1.2, tolerance: 0.24 },
  24: { weight: 1.2, tolerance: 0.24 },
  25: { weight: 1.5, tolerance: 0.32 },
  26: { weight: 1.5, tolerance: 0.32 },
  27: { weight: 1.8, tolerance: 0.38 },
  28: { weight: 1.8, tolerance: 0.38 },
  29: { weight: 1.2, tolerance: 0.46 },
  30: { weight: 1.2, tolerance: 0.46 },
  31: { weight: 1.2, tolerance: 0.46 },
  32: { weight: 1.2, tolerance: 0.46 },
};

export function matchPose(
  wall: BusinessWall,
  frame: PoseFrame | null,
): PoseMatchResult {
  if (!frame || frame.poses.length === 0) {
    return NO_MATCH;
  }

  const bestScore = frame.poses.reduce<number | null>((best, pose) => {
    const poseScore = scorePose(wall.poseId, pose);

    if (poseScore === null) {
      return best;
    }

    if (best === null) {
      return poseScore;
    }

    return Math.max(best, poseScore);
  }, null);

  if (bestScore === null) {
    return NO_MATCH;
  }

  const score = Math.round(clamp(bestScore) * 100);

  return {
    score,
    passed: score >= MATCH_THRESHOLD,
    perfect: score >= PERFECT_THRESHOLD,
    label:
      score >= PERFECT_THRESHOLD
        ? "Perfect alignment"
        : score >= MATCH_THRESHOLD
          ? "Pose matched"
          : "Keep adjusting",
  };
}

function scorePose(poseId: BusinessWall["poseId"], pose: PoseDetection) {
  const userPose = createComparablePose(pose.worldLandmarks);

  if (!userPose) {
    return null;
  }

  const targetPose = TARGET_POSES[poseId];
  const poseScore = objectKeypointSimilarity(userPose, targetPose.points);

  return clamp(poseScore) * pose.confidence;
}

function objectKeypointSimilarity(
  userPose: readonly LandmarkLike[],
  targetPose: readonly LandmarkLike[],
) {
  if (
    userPose.length !== LANDMARKS_PER_POSE ||
    targetPose.length !== LANDMARKS_PER_POSE
  ) {
    return 0;
  }

  let weightedScore = 0;
  let totalWeight = 0;

  for (let index = 0; index < LANDMARKS_PER_POSE; index += 1) {
    const userLandmark = userPose[index];
    const targetLandmark = targetPose[index];
    const config =
      LANDMARK_SCORE_CONFIG[index] ?? DEFAULT_LANDMARK_SCORE_CONFIG;
    const distance = Math.hypot(
      userLandmark.x - targetLandmark.x,
      userLandmark.y - targetLandmark.y,
      userLandmark.z - targetLandmark.z,
    );
    const tolerance = Math.max(config.tolerance, Number.EPSILON);

    weightedScore +=
      Math.exp(-(distance * distance) / (2 * tolerance * tolerance)) *
      config.weight;
    totalWeight += config.weight;
  }

  if (totalWeight === 0) {
    return 0;
  }

  return weightedScore / totalWeight;
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}
