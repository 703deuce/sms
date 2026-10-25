#!/usr/bin/env bash
set -euo pipefail
DEST="${1:-/app/v3}"
mkdir -p "$DEST"
if [[ ! -f "$DEST/yunet.onnx" ]]; then
  curl -fsSL -o "$DEST/yunet.onnx" \
    "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
fi
if [[ ! -f "$DEST/face_landmarker.task" ]]; then
  curl -fsSL -o "$DEST/face_landmarker.task" \
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
fi
echo "models ready in $DEST"
