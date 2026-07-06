import type { StaticImageData } from "next/image";

import buildingMvpImage from "../../../templates/BUILDING_MVP/image.png";
import buildingMvp from "../../../templates/BUILDING_MVP/landmarks.json";
import ceoMindsetImage from "../../../templates/CEO_MINDSET/image.png";
import ceoMindset from "../../../templates/CEO_MINDSET/landmarks.json";
import demoDayImage from "../../../templates/DEMO_DAY/image.png";
import demoDay from "../../../templates/DEMO_DAY/landmarks.json";
import ideaImage from "../../../templates/I_HAVE_AN_IDEA/image.png";
import idea from "../../../templates/I_HAVE_AN_IDEA/landmarks.json";
import networkingImage from "../../../templates/NETWORKING/image.png";
import networking from "../../../templates/NETWORKING/landmarks.json";
import pitchingInvestorsImage from "../../../templates/PITCHING_INVESTORS/image.png";
import pitchingInvestors from "../../../templates/PITCHING_INVESTORS/landmarks.json";
import problemSolvingImage from "../../../templates/PROBLEM_SOLVING/image.png";
import problemSolving from "../../../templates/PROBLEM_SOLVING/landmarks.json";
import scaleUpImage from "../../../templates/SCALE_UP/image.png";
import scaleUp from "../../../templates/SCALE_UP/landmarks.json";
import victoryPoseImage from "../../../templates/VICTORY_POSE/image.png";
import victoryPose from "../../../templates/VICTORY_POSE/landmarks.json";
import welcomeMembersImage from "../../../templates/WELCOME_MEMBERS/image.png";
import welcomeMembers from "../../../templates/WELCOME_MEMBERS/landmarks.json";

export const LANDMARKS_PER_POSE = 33;
const MIN_SCALE = 0.0001;
const LEFT_SHOULDER_INDEX = 11;
const RIGHT_SHOULDER_INDEX = 12;
const LEFT_HIP_INDEX = 23;
const RIGHT_HIP_INDEX = 24;

export type LandmarkLike = {
  x: number;
  y: number;
  z: number;
};

type TargetPoseJson = {
  landmarks: LandmarkLike[][];
  worldLandmarks: LandmarkLike[][];
};

type TargetPoseSource = {
  image: StaticImageData;
  json: TargetPoseJson;
};

export type TargetPose = {
  image: StaticImageData;
  landmarks: LandmarkLike[];
  worldLandmarks: LandmarkLike[];
  points: LandmarkLike[];
};

const TARGET_POSE_SOURCES = {
  BUILDING_MVP: { image: buildingMvpImage, json: buildingMvp },
  CEO_MINDSET: { image: ceoMindsetImage, json: ceoMindset },
  DEMO_DAY: { image: demoDayImage, json: demoDay },
  I_HAVE_AN_IDEA: { image: ideaImage, json: idea },
  NETWORKING: { image: networkingImage, json: networking },
  PITCHING_INVESTORS: {
    image: pitchingInvestorsImage,
    json: pitchingInvestors,
  },
  PROBLEM_SOLVING: { image: problemSolvingImage, json: problemSolving },
  SCALE_UP: { image: scaleUpImage, json: scaleUp },
  VICTORY_POSE: { image: victoryPoseImage, json: victoryPose },
  WELCOME_MEMBERS: { image: welcomeMembersImage, json: welcomeMembers },
} satisfies Record<string, TargetPoseSource>;

export type PoseId = keyof typeof TARGET_POSE_SOURCES;

export const TARGET_POSES: Record<PoseId, TargetPose> = Object.fromEntries(
  Object.entries(TARGET_POSE_SOURCES).map(([poseId, source]) => [
    poseId,
    createTargetPose(poseId as PoseId, source),
  ]),
) as Record<PoseId, TargetPose>;

function createTargetPose(
  poseId: PoseId,
  source: TargetPoseSource,
): TargetPose {
  const landmarks = source.json.landmarks[0];
  const worldLandmarks = source.json.worldLandmarks[0];

  if (
    !isValidLandmarkList(landmarks) ||
    !Array.isArray(worldLandmarks) ||
    worldLandmarks.length !== LANDMARKS_PER_POSE
  ) {
    throw new Error(`Invalid target pose template for ${poseId}.`);
  }

  const points = createComparablePose(worldLandmarks);

  if (!points) {
    throw new Error(`Malformed target pose landmarks for ${poseId}.`);
  }

  return {
    image: source.image,
    landmarks,
    worldLandmarks,
    points,
  };
}

export function createComparablePose(
  landmarks: readonly LandmarkLike[],
): LandmarkLike[] | null {
  if (landmarks.length !== LANDMARKS_PER_POSE) {
    return null;
  }

  const leftShoulder = landmarks[LEFT_SHOULDER_INDEX];
  const rightShoulder = landmarks[RIGHT_SHOULDER_INDEX];
  const leftHip = landmarks[LEFT_HIP_INDEX];
  const rightHip = landmarks[RIGHT_HIP_INDEX];

  if (
    !isFiniteLandmark(leftShoulder) ||
    !isFiniteLandmark(rightShoulder) ||
    !isFiniteLandmark(leftHip) ||
    !isFiniteLandmark(rightHip)
  ) {
    return null;
  }

  const hipCenter = midpoint(leftHip, rightHip);
  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const torsoScale = Math.max(
    distance3D(hipCenter, shoulderCenter),
    distance3D(leftShoulder, rightShoulder),
    MIN_SCALE,
  );

  const points: LandmarkLike[] = [];

  for (const landmark of landmarks) {
    if (!isFiniteLandmark(landmark)) {
      return null;
    }

    points.push({
      x: (landmark.x - hipCenter.x) / torsoScale,
      y: (landmark.y - hipCenter.y) / torsoScale,
      z: (landmark.z - hipCenter.z) / torsoScale,
    });
  }

  return points;
}

function isFiniteLandmark(
  landmark: LandmarkLike | undefined,
): landmark is LandmarkLike {
  return Boolean(
    landmark &&
      Number.isFinite(landmark.x) &&
      Number.isFinite(landmark.y) &&
      Number.isFinite(landmark.z),
  );
}

function isValidLandmarkList(
  landmarks: LandmarkLike[] | undefined,
): landmarks is LandmarkLike[] {
  return Boolean(
    Array.isArray(landmarks) &&
      landmarks.length === LANDMARKS_PER_POSE &&
      landmarks.every(isFiniteLandmark),
  );
}

function midpoint(a: LandmarkLike, b: LandmarkLike): LandmarkLike {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
  };
}

function distance3D(a: LandmarkLike, b: LandmarkLike) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
