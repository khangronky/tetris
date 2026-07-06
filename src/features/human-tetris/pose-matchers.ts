import type {
  BusinessWall,
  DifficultyPhase,
  PoseFrame,
  PoseId,
  PoseLandmark,
  PoseMatchResult,
} from "./types";

const NO_MATCH: PoseMatchResult = {
  score: 0,
  passed: false,
  perfect: false,
  label: "No body detected",
};

const LANDMARK = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
} as const;

type Body = {
  nose: PoseLandmark;
  leftShoulder: PoseLandmark;
  rightShoulder: PoseLandmark;
  leftElbow: PoseLandmark;
  rightElbow: PoseLandmark;
  leftWrist: PoseLandmark;
  rightWrist: PoseLandmark;
  leftHip: PoseLandmark;
  rightHip: PoseLandmark;
  centerX: number;
  shoulderY: number;
  hipY: number;
  shoulderWidth: number;
};

type PoseScorer = (body: Body) => number;

export function matchPose(
  wall: BusinessWall,
  frame: PoseFrame | null,
  difficulty: DifficultyPhase,
): PoseMatchResult {
  if (!frame || frame.landmarks.length < 25) {
    return NO_MATCH;
  }

  const body = getBody(frame.landmarks);

  if (!body) {
    return NO_MATCH;
  }

  const rawScore = POSE_SCORERS[wall.poseId](body);
  const confidenceAdjusted = clamp(rawScore * frame.confidence);
  const score = Number(confidenceAdjusted.toFixed(2));

  return {
    score,
    passed: score >= difficulty.threshold,
    perfect: score >= difficulty.perfectThreshold,
    label:
      score >= difficulty.perfectThreshold
        ? "Perfect alignment"
        : score >= difficulty.threshold
          ? "Pose matched"
          : "Keep adjusting",
  };
}

function getBody(landmarks: PoseLandmark[]): Body | null {
  const body = {
    nose: landmarks[LANDMARK.nose],
    leftShoulder: landmarks[LANDMARK.leftShoulder],
    rightShoulder: landmarks[LANDMARK.rightShoulder],
    leftElbow: landmarks[LANDMARK.leftElbow],
    rightElbow: landmarks[LANDMARK.rightElbow],
    leftWrist: landmarks[LANDMARK.leftWrist],
    rightWrist: landmarks[LANDMARK.rightWrist],
    leftHip: landmarks[LANDMARK.leftHip],
    rightHip: landmarks[LANDMARK.rightHip],
  };

  const required = Object.values(body);

  if (required.some((point) => !point || point.visibility < 0.35)) {
    return null;
  }

  const centerX = (body.leftShoulder.x + body.rightShoulder.x) / 2;
  const shoulderY = (body.leftShoulder.y + body.rightShoulder.y) / 2;
  const hipY = (body.leftHip.y + body.rightHip.y) / 2;
  const shoulderWidth = Math.max(
    Math.abs(body.leftShoulder.x - body.rightShoulder.x),
    0.12,
  );

  return {
    ...body,
    centerX,
    shoulderY,
    hipY,
    shoulderWidth,
  };
}

const POSE_SCORERS: Record<PoseId, PoseScorer> = {
  idea: (body) =>
    average([
      above(body.leftWrist.y, body.nose.y, 0.02),
      above(body.rightWrist.y, body.nose.y, 0.02),
      separated(body.leftWrist.x, body.rightWrist.x, body.shoulderWidth * 0.7),
      above(body.leftElbow.y, body.leftShoulder.y, -0.03),
      above(body.rightElbow.y, body.rightShoulder.y, -0.03),
    ]),

  investorPitch: (body) => oneArmPresenting(body),

  mvpTyping: (body) =>
    average([
      between(body.leftWrist.y, body.shoulderY + 0.12, body.hipY + 0.14),
      between(body.rightWrist.y, body.shoulderY + 0.12, body.hipY + 0.14),
      closeness(Math.abs(body.leftWrist.x - body.rightWrist.x), 0.12, 0.32),
      closeness(
        Math.abs((body.leftWrist.x + body.rightWrist.x) / 2 - body.centerX),
        0,
        body.shoulderWidth,
      ),
      below(body.leftElbow.y, body.leftShoulder.y, 0.04),
      below(body.rightElbow.y, body.rightShoulder.y, 0.04),
    ]),

  networking: (body) =>
    Math.max(
      handshakeArm(body.leftWrist, body.leftElbow, body),
      handshakeArm(body.rightWrist, body.rightElbow, body),
    ),

  demoDay: (body) => oneArmPresenting(body),

  fundingClosed: (body) =>
    average([
      above(body.leftWrist.y, body.leftShoulder.y, 0.12),
      above(body.rightWrist.y, body.rightShoulder.y, 0.12),
      separated(body.leftWrist.x, body.rightWrist.x, body.shoulderWidth * 1.2),
      above(body.leftElbow.y, body.leftShoulder.y, 0),
      above(body.rightElbow.y, body.rightShoulder.y, 0),
    ]),

  problemSolving: (body) =>
    Math.max(
      nearPoint(body.leftWrist, body.nose, 0.18),
      nearPoint(body.rightWrist, body.nose, 0.18),
      nearChin(body.leftWrist, body),
      nearChin(body.rightWrist, body),
    ),

  welcomeTeam: (body) =>
    average([
      separated(body.leftWrist.x, body.rightWrist.x, body.shoulderWidth * 1.65),
      between(body.leftWrist.y, body.shoulderY - 0.1, body.hipY + 0.08),
      between(body.rightWrist.y, body.shoulderY - 0.1, body.hipY + 0.08),
      outsideShoulder(body.leftWrist.x, body.leftShoulder.x, "left"),
      outsideShoulder(body.rightWrist.x, body.rightShoulder.x, "right"),
    ]),

  ceoMindset: (body) =>
    average([
      nearPoint(body.leftWrist, body.leftHip, 0.22),
      nearPoint(body.rightWrist, body.rightHip, 0.22),
      below(body.leftElbow.y, body.leftShoulder.y, 0.08),
      below(body.rightElbow.y, body.rightShoulder.y, 0.08),
      separated(body.leftElbow.x, body.rightElbow.x, body.shoulderWidth * 1.1),
    ]),

  scaleUp: (body) =>
    Math.max(
      rocketArm(body.leftWrist, body.leftElbow, body),
      rocketArm(body.rightWrist, body.rightElbow, body),
    ),
};

function oneArmPresenting(body: Body) {
  return Math.max(
    presentingArm(
      body.leftWrist,
      body.leftElbow,
      body.leftShoulder,
      "left",
      body,
    ),
    presentingArm(
      body.rightWrist,
      body.rightElbow,
      body.rightShoulder,
      "right",
      body,
    ),
  );
}

function presentingArm(
  wrist: PoseLandmark,
  elbow: PoseLandmark,
  shoulder: PoseLandmark,
  side: "left" | "right",
  body: Body,
) {
  return average([
    outsideShoulder(wrist.x, shoulder.x, side),
    separated(wrist.x, body.centerX, body.shoulderWidth * 0.95),
    between(wrist.y, body.shoulderY - 0.08, body.hipY + 0.05),
    between(elbow.y, body.shoulderY - 0.08, body.hipY + 0.1),
    closeness(Math.abs(wrist.y - elbow.y), 0, 0.24),
  ]);
}

function handshakeArm(wrist: PoseLandmark, elbow: PoseLandmark, body: Body) {
  return average([
    closeness(Math.abs(wrist.x - body.centerX), 0.08, body.shoulderWidth * 1.1),
    between(wrist.y, body.shoulderY - 0.04, body.hipY + 0.02),
    separated(wrist.x, elbow.x, body.shoulderWidth * 0.42),
    between(elbow.y, body.shoulderY - 0.08, body.hipY + 0.08),
  ]);
}

function nearChin(wrist: PoseLandmark, body: Body) {
  const chin = {
    x: body.nose.x,
    y: (body.nose.y + body.shoulderY) / 2,
    z: body.nose.z,
    visibility: body.nose.visibility,
  };

  return nearPoint(wrist, chin, 0.18);
}

function rocketArm(wrist: PoseLandmark, elbow: PoseLandmark, body: Body) {
  return average([
    above(wrist.y, body.nose.y, 0.08),
    above(elbow.y, body.leftShoulder.y, 0.02),
    separated(wrist.y, body.hipY, 0.4),
    closeness(
      Math.abs(wrist.x - body.centerX),
      body.shoulderWidth * 0.45,
      0.55,
    ),
  ]);
}

function above(value: number, target: number, margin: number) {
  return value <= target - margin
    ? 1
    : closeness(value - target, -margin, 0.18);
}

function below(value: number, target: number, margin: number) {
  return value >= target + margin
    ? 1
    : closeness(target - value, -margin, 0.18);
}

function between(value: number, min: number, max: number) {
  if (value >= min && value <= max) {
    return 1;
  }

  return value < min
    ? closeness(min - value, 0, 0.22)
    : closeness(value - max, 0, 0.22);
}

function separated(a: number, b: number, minimum: number) {
  return clamp(Math.abs(a - b) / minimum);
}

function outsideShoulder(
  wristX: number,
  shoulderX: number,
  side: "left" | "right",
) {
  const outsideDistance =
    side === "left" ? shoulderX - wristX : wristX - shoulderX;

  return clamp(outsideDistance / 0.18);
}

function nearPoint(point: PoseLandmark, target: PoseLandmark, radius: number) {
  return 1 - clamp(distance(point, target) / radius);
}

function closeness(value: number, target: number, tolerance: number) {
  return 1 - clamp(Math.abs(value - target) / tolerance);
}

function distance(a: PoseLandmark, b: PoseLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return clamp(
    values.reduce((total, value) => total + value, 0) / values.length,
  );
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}
