import type {
  BusinessWall,
  DifficultyPhase,
  PoseDetection,
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

const MIN_WORLD_LANDMARKS = 25;
const MIN_VISIBILITY = 0.35;
const MIN_DIRECTION_COSINE = 0.12;

type Vector3 = {
  x: number;
  y: number;
  z: number;
};

type PhysicalJoint =
  | "nose"
  | "leftShoulder"
  | "rightShoulder"
  | "leftElbow"
  | "rightElbow"
  | "leftWrist"
  | "rightWrist"
  | "leftHip"
  | "rightHip";

type VirtualJoint = "shoulderCenter" | "hipCenter" | "chin";
type WorldJoint = PhysicalJoint | VirtualJoint;

type WorldBody = {
  points: Record<WorldJoint, PoseLandmark>;
  shoulderWidth: number;
  torsoScale: number;
};

type ScoreTerm = {
  weight: number;
  score: (body: WorldBody) => number;
};

type PoseVariant = {
  terms: ScoreTerm[];
};

type ScreenBody = {
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

type LegacyPoseScorer = (body: ScreenBody) => number;

export function matchPose(
  wall: BusinessWall,
  frame: PoseFrame | null,
  difficulty: DifficultyPhase,
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

  const confidenceAdjusted = clamp(bestScore);
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

function scorePose(poseId: PoseId, pose: PoseDetection) {
  const worldScore =
    pose.worldLandmarks.length >= MIN_WORLD_LANDMARKS
      ? scoreWorldPose(poseId, pose.worldLandmarks)
      : null;
  const rawScore = worldScore ?? scoreLegacyPose(poseId, pose.landmarks);

  return rawScore === null ? null : clamp(rawScore * pose.confidence);
}

function scoreWorldPose(poseId: PoseId, landmarks: PoseLandmark[]) {
  const body = getWorldBody(landmarks);

  if (!body) {
    return null;
  }

  return Math.max(
    ...TARGET_POSE_TEMPLATES[poseId].map((template) =>
      scoreTemplate(template, body),
    ),
  );
}

const TARGET_POSE_TEMPLATES: Record<PoseId, PoseVariant[]> = {
  idea: [
    variant([
      direction("leftShoulder", "leftElbow", { x: -0.45, y: -0.9, z: 0 }, 0.9),
      direction("rightShoulder", "rightElbow", { x: 0.45, y: -0.9, z: 0 }, 0.9),
      direction("leftElbow", "leftWrist", { x: -0.22, y: -1, z: 0 }, 1.2),
      direction("rightElbow", "rightWrist", { x: 0.22, y: -1, z: 0 }, 1.2),
      above("leftWrist", "nose", 0.04, 1.1),
      above("rightWrist", "nose", 0.04, 1.1),
      separated("leftWrist", "rightWrist", 0.45, 0.7, "x"),
    ]),
  ],

  investorPitch: presentingTemplates(),

  mvpTyping: [
    variant([
      direction("leftElbow", "leftWrist", { x: 0.35, y: 0.85, z: 0 }, 1),
      direction("rightElbow", "rightWrist", { x: -0.35, y: 0.85, z: 0 }, 1),
      yBetween("leftWrist", "shoulderCenter", "hipCenter", 0.18, 1),
      yBetween("rightWrist", "shoulderCenter", "hipCenter", 0.18, 1),
      xNear("leftWrist", "shoulderCenter", 0.52, 0.9),
      xNear("rightWrist", "shoulderCenter", 0.52, 0.9),
      near("leftWrist", "rightWrist", 0.62, 1.1),
      below("leftWrist", "shoulderCenter", 0.18, 0.8),
      below("rightWrist", "shoulderCenter", 0.18, 0.8),
    ]),
  ],

  networking: handshakeTemplates(),

  demoDay: presentingTemplates(),

  fundingClosed: [
    variant([
      direction("leftShoulder", "leftElbow", { x: -0.72, y: -0.72, z: 0 }, 1),
      direction("rightShoulder", "rightElbow", { x: 0.72, y: -0.72, z: 0 }, 1),
      direction("leftElbow", "leftWrist", { x: -0.75, y: -0.75, z: 0 }, 1.2),
      direction("rightElbow", "rightWrist", { x: 0.75, y: -0.75, z: 0 }, 1.2),
      above("leftWrist", "leftShoulder", 0.22, 1),
      above("rightWrist", "rightShoulder", 0.22, 1),
      separated("leftWrist", "rightWrist", 1.08, 1.1, "x"),
    ]),
  ],

  problemSolving: thinkingTemplates(),

  welcomeTeam: [
    variant([
      direction("leftShoulder", "leftElbow", { x: -1, y: 0, z: 0 }, 1),
      direction("rightShoulder", "rightElbow", { x: 1, y: 0, z: 0 }, 1),
      direction("leftElbow", "leftWrist", { x: -1, y: 0.04, z: 0 }, 1.1),
      direction("rightElbow", "rightWrist", { x: 1, y: 0.04, z: 0 }, 1.1),
      separated("leftWrist", "rightWrist", 1.28, 1.2, "x"),
      yBetween("leftWrist", "shoulderCenter", "hipCenter", 0.22, 0.8),
      yBetween("rightWrist", "shoulderCenter", "hipCenter", 0.22, 0.8),
    ]),
  ],

  ceoMindset: [
    variant([
      direction("leftShoulder", "leftElbow", { x: -0.45, y: 0.9, z: 0 }, 0.9),
      direction("rightShoulder", "rightElbow", { x: 0.45, y: 0.9, z: 0 }, 0.9),
      near("leftWrist", "leftHip", 0.42, 1.3),
      near("rightWrist", "rightHip", 0.42, 1.3),
      below("leftElbow", "leftShoulder", 0.12, 0.8),
      below("rightElbow", "rightShoulder", 0.12, 0.8),
      separated("leftElbow", "rightElbow", 0.82, 0.6, "x"),
    ]),
  ],

  scaleUp: rocketTemplates(),
};

function presentingTemplates() {
  return [oneArmPresentingTemplate("left"), oneArmPresentingTemplate("right")];
}

function oneArmPresentingTemplate(side: "left" | "right"): PoseVariant {
  const shoulder = side === "left" ? "leftShoulder" : "rightShoulder";
  const elbow = side === "left" ? "leftElbow" : "rightElbow";
  const wrist = side === "left" ? "leftWrist" : "rightWrist";
  const x = side === "left" ? -1 : 1;

  return variant([
    direction(shoulder, elbow, { x, y: 0.04, z: 0 }, 1),
    direction(elbow, wrist, { x, y: 0.02, z: 0 }, 1.2),
    separated(wrist, "shoulderCenter", 0.64, 1, "x"),
    yBetween(wrist, "shoulderCenter", "hipCenter", 0.22, 0.9),
    sameHeight(wrist, elbow, 0.28, 0.6),
  ]);
}

function handshakeTemplates() {
  return [handshakeTemplate("left"), handshakeTemplate("right")];
}

function handshakeTemplate(side: "left" | "right"): PoseVariant {
  const elbow = side === "left" ? "leftElbow" : "rightElbow";
  const wrist = side === "left" ? "leftWrist" : "rightWrist";
  const x = side === "left" ? 1 : -1;

  return variant([
    direction(elbow, wrist, { x, y: 0.08, z: 0 }, 1),
    xNear(wrist, "shoulderCenter", 0.5, 1.2),
    yBetween(wrist, "shoulderCenter", "hipCenter", 0.16, 1),
    separated(wrist, elbow, 0.34, 0.8, "x"),
    below(wrist, "shoulderCenter", 0.04, 0.6),
  ]);
}

function thinkingTemplates() {
  return [thinkingTemplate("left"), thinkingTemplate("right")];
}

function thinkingTemplate(side: "left" | "right"): PoseVariant {
  const elbow = side === "left" ? "leftElbow" : "rightElbow";
  const wrist = side === "left" ? "leftWrist" : "rightWrist";
  const x = side === "left" ? 0.35 : -0.35;

  return variant([
    direction(elbow, wrist, { x, y: -0.85, z: 0 }, 0.9),
    near(wrist, "chin", 0.44, 1.5),
    above(wrist, "shoulderCenter", 0.04, 0.8),
    xNear(wrist, "nose", 0.42, 0.8),
  ]);
}

function rocketTemplates() {
  return [rocketTemplate("left"), rocketTemplate("right")];
}

function rocketTemplate(side: "left" | "right"): PoseVariant {
  const shoulder = side === "left" ? "leftShoulder" : "rightShoulder";
  const elbow = side === "left" ? "leftElbow" : "rightElbow";
  const wrist = side === "left" ? "leftWrist" : "rightWrist";
  const x = side === "left" ? -0.28 : 0.28;

  return variant([
    direction(shoulder, elbow, { x, y: -0.96, z: 0 }, 1),
    direction(elbow, wrist, { x, y: -0.96, z: 0 }, 1.2),
    above(wrist, "nose", 0.14, 1.3),
    above(elbow, shoulder, 0.04, 0.8),
    separated(wrist, "shoulderCenter", 0.24, 0.5, "x"),
  ]);
}

function variant(terms: ScoreTerm[]): PoseVariant {
  return { terms };
}

function direction(
  from: WorldJoint,
  to: WorldJoint,
  target: Vector3,
  weight: number,
  minCosine = MIN_DIRECTION_COSINE,
): ScoreTerm {
  const targetUnit = unitVector(target);
  const mirroredTargetUnit = unitVector({ ...target, x: -target.x });

  return {
    weight,
    score(body) {
      const actual = vectorBetween(body.points[from], body.points[to]);
      const primary = directionToScore(
        cosineSimilarity(actual, targetUnit),
        minCosine,
      );
      const mirrored = directionToScore(
        cosineSimilarity(actual, mirroredTargetUnit),
        minCosine,
      );

      return Math.max(primary, mirrored);
    },
  };
}

function above(
  point: WorldJoint,
  target: WorldJoint,
  marginScale: number,
  weight: number,
): ScoreTerm {
  return {
    weight,
    score(body) {
      const distanceAbove =
        (body.points[target].y - body.points[point].y) / body.torsoScale;

      return thresholdScore(distanceAbove, marginScale);
    },
  };
}

function below(
  point: WorldJoint,
  target: WorldJoint,
  marginScale: number,
  weight: number,
): ScoreTerm {
  return {
    weight,
    score(body) {
      const distanceBelow =
        (body.points[point].y - body.points[target].y) / body.torsoScale;

      return thresholdScore(distanceBelow, marginScale);
    },
  };
}

function near(
  point: WorldJoint,
  target: WorldJoint,
  radiusScale: number,
  weight: number,
): ScoreTerm {
  return {
    weight,
    score(body) {
      return (
        1 -
        clamp(
          distance3D(body.points[point], body.points[target]) /
            (body.torsoScale * radiusScale),
        )
      );
    },
  };
}

function xNear(
  point: WorldJoint,
  target: WorldJoint,
  radiusScale: number,
  weight: number,
): ScoreTerm {
  return {
    weight,
    score(body) {
      return (
        1 -
        clamp(
          Math.abs(body.points[point].x - body.points[target].x) /
            (body.torsoScale * radiusScale),
        )
      );
    },
  };
}

function yBetween(
  point: WorldJoint,
  top: WorldJoint,
  bottom: WorldJoint,
  slackScale: number,
  weight: number,
): ScoreTerm {
  return {
    weight,
    score(body) {
      const y = body.points[point].y;
      const topY = Math.min(body.points[top].y, body.points[bottom].y);
      const bottomY = Math.max(body.points[top].y, body.points[bottom].y);
      const slack = body.torsoScale * slackScale;

      if (y >= topY - slack && y <= bottomY + slack) {
        return 1;
      }

      const outsideDistance =
        y < topY - slack ? topY - slack - y : y - (bottomY + slack);

      return (
        1 - clamp(outsideDistance / Math.max(slack, body.torsoScale * 0.2))
      );
    },
  };
}

function separated(
  a: WorldJoint,
  b: WorldJoint,
  minimumScale: number,
  weight: number,
  axis: "x" | "xyz",
): ScoreTerm {
  return {
    weight,
    score(body) {
      const actualDistance =
        axis === "x"
          ? Math.abs(body.points[a].x - body.points[b].x)
          : distance3D(body.points[a], body.points[b]);

      return clamp(actualDistance / (body.torsoScale * minimumScale));
    },
  };
}

function sameHeight(
  a: WorldJoint,
  b: WorldJoint,
  toleranceScale: number,
  weight: number,
): ScoreTerm {
  return {
    weight,
    score(body) {
      return (
        1 -
        clamp(
          Math.abs(body.points[a].y - body.points[b].y) /
            (body.torsoScale * toleranceScale),
        )
      );
    },
  };
}

function scoreTemplate(template: PoseVariant, body: WorldBody) {
  const totalWeight = template.terms.reduce(
    (total, term) => total + term.weight,
    0,
  );

  if (totalWeight <= 0) {
    return 0;
  }

  return clamp(
    template.terms.reduce(
      (total, term) => total + term.score(body) * term.weight,
      0,
    ) / totalWeight,
  );
}

function getWorldBody(landmarks: PoseLandmark[]): WorldBody | null {
  const nose = landmarks[LANDMARK.nose];
  const leftShoulder = landmarks[LANDMARK.leftShoulder];
  const rightShoulder = landmarks[LANDMARK.rightShoulder];
  const leftElbow = landmarks[LANDMARK.leftElbow];
  const rightElbow = landmarks[LANDMARK.rightElbow];
  const leftWrist = landmarks[LANDMARK.leftWrist];
  const rightWrist = landmarks[LANDMARK.rightWrist];
  const leftHip = landmarks[LANDMARK.leftHip];
  const rightHip = landmarks[LANDMARK.rightHip];

  if (
    !isUsableLandmark(nose) ||
    !isUsableLandmark(leftShoulder) ||
    !isUsableLandmark(rightShoulder) ||
    !isUsableLandmark(leftElbow) ||
    !isUsableLandmark(rightElbow) ||
    !isUsableLandmark(leftWrist) ||
    !isUsableLandmark(rightWrist) ||
    !isUsableLandmark(leftHip) ||
    !isUsableLandmark(rightHip)
  ) {
    return null;
  }

  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  const chin = midpoint(nose, shoulderCenter);
  const shoulderWidth = Math.max(distance3D(leftShoulder, rightShoulder), 0.18);
  const torsoScale = Math.max(
    distance3D(shoulderCenter, hipCenter),
    shoulderWidth,
    0.2,
  );

  return {
    points: {
      nose,
      leftShoulder,
      rightShoulder,
      leftElbow,
      rightElbow,
      leftWrist,
      rightWrist,
      leftHip,
      rightHip,
      shoulderCenter,
      hipCenter,
      chin,
    },
    shoulderWidth,
    torsoScale,
  };
}

function scoreLegacyPose(poseId: PoseId, landmarks: PoseLandmark[]) {
  const body = getScreenBody(landmarks);

  if (!body) {
    return null;
  }

  return LEGACY_POSE_SCORERS[poseId](body);
}

function getScreenBody(landmarks: PoseLandmark[]): ScreenBody | null {
  const nose = landmarks[LANDMARK.nose];
  const leftShoulder = landmarks[LANDMARK.leftShoulder];
  const rightShoulder = landmarks[LANDMARK.rightShoulder];
  const leftElbow = landmarks[LANDMARK.leftElbow];
  const rightElbow = landmarks[LANDMARK.rightElbow];
  const leftWrist = landmarks[LANDMARK.leftWrist];
  const rightWrist = landmarks[LANDMARK.rightWrist];
  const leftHip = landmarks[LANDMARK.leftHip];
  const rightHip = landmarks[LANDMARK.rightHip];

  if (
    !isUsableLandmark(nose) ||
    !isUsableLandmark(leftShoulder) ||
    !isUsableLandmark(rightShoulder) ||
    !isUsableLandmark(leftElbow) ||
    !isUsableLandmark(rightElbow) ||
    !isUsableLandmark(leftWrist) ||
    !isUsableLandmark(rightWrist) ||
    !isUsableLandmark(leftHip) ||
    !isUsableLandmark(rightHip)
  ) {
    return null;
  }

  const centerX = (leftShoulder.x + rightShoulder.x) / 2;
  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipY = (leftHip.y + rightHip.y) / 2;
  const shoulderWidth = Math.max(
    Math.abs(leftShoulder.x - rightShoulder.x),
    0.12,
  );

  return {
    nose,
    leftShoulder,
    rightShoulder,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
    leftHip,
    rightHip,
    centerX,
    shoulderY,
    hipY,
    shoulderWidth,
  };
}

const LEGACY_POSE_SCORERS: Record<PoseId, LegacyPoseScorer> = {
  idea: (body) =>
    average([
      above2D(body.leftWrist.y, body.nose.y, 0.02),
      above2D(body.rightWrist.y, body.nose.y, 0.02),
      separated2D(
        body.leftWrist.x,
        body.rightWrist.x,
        body.shoulderWidth * 0.7,
      ),
      above2D(body.leftElbow.y, body.leftShoulder.y, -0.03),
      above2D(body.rightElbow.y, body.rightShoulder.y, -0.03),
    ]),

  investorPitch: (body) => oneArmPresenting2D(body),

  mvpTyping: (body) =>
    average([
      between2D(body.leftWrist.y, body.shoulderY + 0.12, body.hipY + 0.14),
      between2D(body.rightWrist.y, body.shoulderY + 0.12, body.hipY + 0.14),
      closeness(Math.abs(body.leftWrist.x - body.rightWrist.x), 0.12, 0.32),
      closeness(
        Math.abs((body.leftWrist.x + body.rightWrist.x) / 2 - body.centerX),
        0,
        body.shoulderWidth,
      ),
      below2D(body.leftElbow.y, body.leftShoulder.y, 0.04),
      below2D(body.rightElbow.y, body.rightShoulder.y, 0.04),
    ]),

  networking: (body) =>
    Math.max(
      handshakeArm2D(body.leftWrist, body.leftElbow, body),
      handshakeArm2D(body.rightWrist, body.rightElbow, body),
    ),

  demoDay: (body) => oneArmPresenting2D(body),

  fundingClosed: (body) =>
    average([
      above2D(body.leftWrist.y, body.leftShoulder.y, 0.12),
      above2D(body.rightWrist.y, body.rightShoulder.y, 0.12),
      separated2D(
        body.leftWrist.x,
        body.rightWrist.x,
        body.shoulderWidth * 1.2,
      ),
      above2D(body.leftElbow.y, body.leftShoulder.y, 0),
      above2D(body.rightElbow.y, body.rightShoulder.y, 0),
    ]),

  problemSolving: (body) =>
    Math.max(
      nearPoint2D(body.leftWrist, body.nose, 0.18),
      nearPoint2D(body.rightWrist, body.nose, 0.18),
      nearChin2D(body.leftWrist, body),
      nearChin2D(body.rightWrist, body),
    ),

  welcomeTeam: (body) =>
    average([
      separated2D(
        body.leftWrist.x,
        body.rightWrist.x,
        body.shoulderWidth * 1.65,
      ),
      between2D(body.leftWrist.y, body.shoulderY - 0.1, body.hipY + 0.08),
      between2D(body.rightWrist.y, body.shoulderY - 0.1, body.hipY + 0.08),
      outsideShoulder2D(body.leftWrist.x, body.leftShoulder.x, "left"),
      outsideShoulder2D(body.rightWrist.x, body.rightShoulder.x, "right"),
    ]),

  ceoMindset: (body) =>
    average([
      nearPoint2D(body.leftWrist, body.leftHip, 0.22),
      nearPoint2D(body.rightWrist, body.rightHip, 0.22),
      below2D(body.leftElbow.y, body.leftShoulder.y, 0.08),
      below2D(body.rightElbow.y, body.rightShoulder.y, 0.08),
      separated2D(
        body.leftElbow.x,
        body.rightElbow.x,
        body.shoulderWidth * 1.1,
      ),
    ]),

  scaleUp: (body) =>
    Math.max(
      rocketArm2D(body.leftWrist, body.leftElbow, body),
      rocketArm2D(body.rightWrist, body.rightElbow, body),
    ),
};

function oneArmPresenting2D(body: ScreenBody) {
  return Math.max(
    presentingArm2D(
      body.leftWrist,
      body.leftElbow,
      body.leftShoulder,
      "left",
      body,
    ),
    presentingArm2D(
      body.rightWrist,
      body.rightElbow,
      body.rightShoulder,
      "right",
      body,
    ),
  );
}

function presentingArm2D(
  wrist: PoseLandmark,
  elbow: PoseLandmark,
  shoulder: PoseLandmark,
  side: "left" | "right",
  body: ScreenBody,
) {
  return average([
    outsideShoulder2D(wrist.x, shoulder.x, side),
    separated2D(wrist.x, body.centerX, body.shoulderWidth * 0.95),
    between2D(wrist.y, body.shoulderY - 0.08, body.hipY + 0.05),
    between2D(elbow.y, body.shoulderY - 0.08, body.hipY + 0.1),
    closeness(Math.abs(wrist.y - elbow.y), 0, 0.24),
  ]);
}

function handshakeArm2D(
  wrist: PoseLandmark,
  elbow: PoseLandmark,
  body: ScreenBody,
) {
  return average([
    closeness(Math.abs(wrist.x - body.centerX), 0.08, body.shoulderWidth * 1.1),
    between2D(wrist.y, body.shoulderY - 0.04, body.hipY + 0.02),
    separated2D(wrist.x, elbow.x, body.shoulderWidth * 0.42),
    between2D(elbow.y, body.shoulderY - 0.08, body.hipY + 0.08),
  ]);
}

function nearChin2D(wrist: PoseLandmark, body: ScreenBody) {
  const chin = {
    x: body.nose.x,
    y: (body.nose.y + body.shoulderY) / 2,
    z: body.nose.z,
    visibility: body.nose.visibility,
    presence: body.nose.presence,
  };

  return nearPoint2D(wrist, chin, 0.18);
}

function rocketArm2D(
  wrist: PoseLandmark,
  elbow: PoseLandmark,
  body: ScreenBody,
) {
  return average([
    above2D(wrist.y, body.nose.y, 0.08),
    above2D(elbow.y, body.leftShoulder.y, 0.02),
    separated2D(wrist.y, body.hipY, 0.4),
    closeness(
      Math.abs(wrist.x - body.centerX),
      body.shoulderWidth * 0.45,
      0.55,
    ),
  ]);
}

function above2D(value: number, target: number, margin: number) {
  return value <= target - margin
    ? 1
    : closeness(value - target, -margin, 0.18);
}

function below2D(value: number, target: number, margin: number) {
  return value >= target + margin
    ? 1
    : closeness(target - value, -margin, 0.18);
}

function between2D(value: number, min: number, max: number) {
  if (value >= min && value <= max) {
    return 1;
  }

  return value < min
    ? closeness(min - value, 0, 0.22)
    : closeness(value - max, 0, 0.22);
}

function separated2D(a: number, b: number, minimum: number) {
  return clamp(Math.abs(a - b) / minimum);
}

function outsideShoulder2D(
  wristX: number,
  shoulderX: number,
  side: "left" | "right",
) {
  const outsideDistance =
    side === "left" ? shoulderX - wristX : wristX - shoulderX;

  return clamp(outsideDistance / 0.18);
}

function nearPoint2D(
  point: PoseLandmark,
  target: PoseLandmark,
  radius: number,
) {
  return 1 - clamp(distance2D(point, target) / radius);
}

function isUsableLandmark(
  landmark: PoseLandmark | undefined,
): landmark is PoseLandmark {
  return Boolean(
    landmark &&
      Number.isFinite(landmark.x) &&
      Number.isFinite(landmark.y) &&
      Number.isFinite(landmark.z) &&
      Math.min(landmark.visibility, landmark.presence ?? 1) >= MIN_VISIBILITY,
  );
}

function directionToScore(cosine: number, minimum: number) {
  return clamp((cosine - minimum) / (1 - minimum));
}

export function cosineSimilarity(a: Vector3, b: Vector3) {
  const aLength = vectorLength(a);
  const bLength = vectorLength(b);

  if (aLength === 0 || bLength === 0) {
    return 0;
  }

  return (a.x * b.x + a.y * b.y + a.z * b.z) / (aLength * bLength);
}

function unitVector(vector: Vector3): Vector3 {
  const length = vectorLength(vector);

  if (length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function vectorBetween(from: PoseLandmark, to: PoseLandmark): Vector3 {
  return {
    x: to.x - from.x,
    y: to.y - from.y,
    z: to.z - from.z,
  };
}

function vectorLength(vector: Vector3) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function midpoint(a: PoseLandmark, b: PoseLandmark): PoseLandmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility, b.visibility),
    presence:
      a.presence === undefined && b.presence === undefined
        ? undefined
        : Math.min(a.presence ?? 1, b.presence ?? 1),
  };
}

function thresholdScore(value: number, target: number) {
  if (target <= 0) {
    return value >= target ? 1 : clamp(1 + value / 0.1);
  }

  return clamp(value / target);
}

function distance3D(a: PoseLandmark, b: PoseLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function distance2D(a: PoseLandmark, b: PoseLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function closeness(value: number, target: number, tolerance: number) {
  return 1 - clamp(Math.abs(value - target) / tolerance);
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
