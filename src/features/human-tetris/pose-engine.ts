import type {
  FilesetResolver,
  Landmark,
  PoseLandmarker as MediaPipePoseLandmarker,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";

import type { PoseFrame, PoseLandmark } from "./types";

const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const MAX_POSES = 1;
const LANDMARKS_PER_POSE = 33;
const REQUIRED_BODY_LANDMARKS = [0, 11, 12, 13, 14, 15, 16, 23, 24];

export type PoseEngine = {
  detect: (video: HTMLVideoElement, timestampMs: number) => PoseFrame | null;
  close: () => void;
};

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

export async function createPoseEngine(): Promise<PoseEngine> {
  const { FilesetResolver, PoseLandmarker } = await import(
    "@mediapipe/tasks-vision"
  );
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
  const landmarker = await createLandmarker(PoseLandmarker, vision);

  return {
    detect(video, timestampMs) {
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return null;
      }

      const result = landmarker.detectForVideo(video, timestampMs);
      const poses = result.landmarks.flatMap((landmarks, index) => {
        if (landmarks.length !== LANDMARKS_PER_POSE) {
          return [];
        }

        const worldLandmarks = result.worldLandmarks[index] ?? [];
        const copiedLandmarks = landmarks.map(copyLandmark);
        const copiedWorldLandmarks =
          worldLandmarks.length === LANDMARKS_PER_POSE
            ? worldLandmarks.map(copyLandmark)
            : [];
        const confidenceLandmarks =
          copiedWorldLandmarks.length > 0
            ? copiedWorldLandmarks
            : copiedLandmarks;

        return [
          {
            index,
            landmarks: copiedLandmarks,
            worldLandmarks: copiedWorldLandmarks,
            confidence: getRequiredBodyConfidence(confidenceLandmarks),
          },
        ];
      });

      if (poses.length === 0) {
        return null;
      }

      return {
        poses,
        detectedAtMs: timestampMs,
        width: video.videoWidth,
        height: video.videoHeight,
      };
    },
    close() {
      landmarker.close();
    },
  };
}

async function createLandmarker(
  PoseLandmarker: typeof MediaPipePoseLandmarker,
  vision: WasmFileset,
) {
  try {
    return await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: MAX_POSES,
      minPoseDetectionConfidence: 0.45,
      minPosePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
    });
  } catch {
    return PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numPoses: MAX_POSES,
      minPoseDetectionConfidence: 0.45,
      minPosePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
    });
  }
}

type MediaPipeLandmark = (Landmark | NormalizedLandmark) & {
  presence?: number;
};

function copyLandmark(landmark: MediaPipeLandmark): PoseLandmark {
  return {
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    visibility: landmark.visibility ?? 0,
    presence: landmark.presence,
  };
}

function getRequiredBodyConfidence(landmarks: PoseLandmark[]) {
  const visibilityValues = REQUIRED_BODY_LANDMARKS.map((index) => {
    const landmark = landmarks[index];

    if (!landmark) {
      return 0;
    }

    return Math.min(landmark.visibility, landmark.presence ?? 1);
  });
  const confidence =
    visibilityValues.reduce((total, value) => total + value, 0) /
    visibilityValues.length;

  return Math.max(0.45, Math.min(1, confidence));
}
