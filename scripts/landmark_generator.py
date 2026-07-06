from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path
from typing import Any

import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
DEFAULT_TEMPLATES_DIR = ROOT_DIR / "templates"
DEFAULT_MODEL_DIR = ROOT_DIR / "models"
DEFAULT_MODEL_PATH = DEFAULT_MODEL_DIR / "pose_landmarker_lite.task"
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate landmarks.json files from templates/*/image.png "
            "using MediaPipe Pose Landmarker."
        )
    )
    parser.add_argument(
        "--templates-dir",
        type=Path,
        default=DEFAULT_TEMPLATES_DIR,
        help="Root directory containing template folders.",
    )
    parser.add_argument(
        "--model-path",
        type=Path,
        default=DEFAULT_MODEL_PATH,
        help="Path to the MediaPipe .task model file.",
    )
    return parser.parse_args()


def ensure_model(model_path: Path) -> Path:
    if model_path.exists():
        return model_path

    model_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading model to {model_path} ...")
    urllib.request.urlretrieve(MODEL_URL, model_path)
    return model_path


def create_landmarker(model_path: Path) -> vision.PoseLandmarker:
    options = vision.PoseLandmarkerOptions(
        base_options=python.BaseOptions(model_asset_path=str(model_path)),
        running_mode=vision.RunningMode.IMAGE,
        num_poses=1,
        output_segmentation_masks=False,
    )
    return vision.PoseLandmarker.create_from_options(options)


def get_template_dirs(templates_dir: Path) -> list[Path]:
    if not templates_dir.exists():
        raise FileNotFoundError(f"Templates directory not found: {templates_dir}")

    return sorted(path for path in templates_dir.iterdir() if path.is_dir())


def normalize_landmark(landmark: Any) -> dict[str, float]:
    normalized = {
        "x": float(landmark.x),
        "y": float(landmark.y),
        "z": float(landmark.z),
        "visibility": float(getattr(landmark, "visibility", 0.0) or 0.0),
    }

    presence = getattr(landmark, "presence", None)
    if presence is not None:
        normalized["presence"] = float(presence)

    return normalized


def detect_image(
    landmarker: vision.PoseLandmarker,
    image_path: Path,
) -> dict[str, list[list[dict[str, float]]]]:
    image = mp.Image.create_from_file(str(image_path))
    result = landmarker.detect(image)

    landmarks = [
        [normalize_landmark(landmark) for landmark in pose]
        for pose in result.pose_landmarks
    ]
    world_landmarks = [
        [normalize_landmark(landmark) for landmark in pose]
        for pose in result.pose_world_landmarks
    ]

    return {
        "landmarks": landmarks,
        "worldLandmarks": world_landmarks,
    }


def write_result(output_path: Path, result: dict[str, Any]) -> None:
    output_path.write_text(f"{json.dumps(result, indent=2)}\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    templates_dir = args.templates_dir.resolve()
    model_path = ensure_model(args.model_path.resolve())
    template_dirs = get_template_dirs(templates_dir)

    if not template_dirs:
        print("No template folders found.")
        return 0

    processed = 0
    detected = 0

    with create_landmarker(model_path) as landmarker:
        for template_dir in template_dirs:
            image_path = template_dir / "image.png"
            output_path = template_dir / "landmarks.json"

            if not image_path.exists():
                print(f"skip {template_dir.name}: missing image.png")
                continue

            result = detect_image(landmarker, image_path)
            write_result(output_path, result)

            pose_count = len(result["landmarks"])
            processed += 1
            if pose_count > 0:
                detected += 1

            print(f"saved {template_dir.name}/landmarks.json (poses={pose_count})")

    print(
        f"done: processed={processed}, "
        f"detected={detected}, "
        f"empty={processed - detected}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        raise SystemExit(130)
