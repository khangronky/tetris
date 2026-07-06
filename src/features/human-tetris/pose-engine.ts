import type {
  FilesetResolver,
  PoseLandmarker as MediaPipePoseLandmarker,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";

import type { PoseFrame, PoseLandmark } from "./types";

const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

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
      const landmarks = result.landmarks[0];

      if (!landmarks || landmarks.length === 0) {
        return null;
      }

      const copiedLandmarks = landmarks.map(copyLandmark);
      const confidence =
        copiedLandmarks.reduce(
          (total, landmark) => total + landmark.visibility,
          0,
        ) / copiedLandmarks.length;

      return {
        landmarks: copiedLandmarks,
        confidence: Math.max(0.45, Math.min(1, confidence)),
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
      numPoses: 1,
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
      numPoses: 1,
      minPoseDetectionConfidence: 0.45,
      minPosePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
    });
  }
}

function copyLandmark(landmark: NormalizedLandmark): PoseLandmark {
  return {
    x: landmark.x,
    y: landmark.y,
    z: landmark.z,
    visibility: landmark.visibility ?? 0,
  };
}
