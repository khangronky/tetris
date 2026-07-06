import type { RecordingResult } from "./types";

const MIME_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4;codecs=h264",
  "video/mp4",
];

export type ActiveRecording = {
  stop: () => Promise<RecordingResult>;
  cancel: () => void;
};

export function isRecordingSupported() {
  return typeof MediaRecorder !== "undefined";
}

export function startCanvasRecording(
  canvas: HTMLCanvasElement,
): ActiveRecording {
  if (!isRecordingSupported()) {
    throw new Error("MediaRecorder is not supported in this browser.");
  }

  const stream = canvas.captureStream(30);
  const chunks: BlobPart[] = [];
  const mimeType = getSupportedMimeType();
  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType } : undefined,
  );
  const extension = (mimeType ?? "").includes("mp4") ? "mp4" : "webm";
  const fileName = `human-tetris-founder-${Date.now()}.${extension}`;

  const stopped = new Promise<RecordingResult>((resolve, reject) => {
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    });

    recorder.addEventListener("stop", () => {
      stopStream(stream);

      if (chunks.length === 0) {
        reject(new Error("Recording ended without video data."));
        return;
      }

      const blob = new Blob(chunks, {
        type: mimeType || "video/webm",
      });

      resolve({
        blob,
        url: URL.createObjectURL(blob),
        mimeType: blob.type,
        fileName,
      });
    });

    recorder.addEventListener("error", () => {
      stopStream(stream);
      reject(new Error("Recording failed."));
    });
  });

  recorder.start(250);

  return {
    stop() {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }

      return stopped;
    },
    cancel() {
      stopped.catch(() => undefined);

      if (recorder.state !== "inactive") {
        recorder.stop();
      }

      stopStream(stream);
    },
  };
}

export async function shareRecording(recording: RecordingResult) {
  const file = new File([recording.blob], recording.fileName, {
    type: recording.mimeType,
  });

  if (
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] }) &&
    typeof navigator.share === "function"
  ) {
    await navigator.share({
      files: [file],
      title: "Human Tetris: Founder Edition",
      text: "Can your friends beat this Founder Score?",
    });

    return true;
  }

  return false;
}

export function downloadRecording(recording: RecordingResult) {
  const anchor = document.createElement("a");
  anchor.href = recording.url;
  anchor.download = recording.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function getSupportedMimeType() {
  return MIME_TYPES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function stopStream(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}
