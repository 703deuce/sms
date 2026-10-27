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
if [[ ! -f "$DEST/face_recognition_sface_2021dec.onnx" ]]; then
  curl -fsSL -o "$DEST/face_recognition_sface_2021dec.onnx" \
    "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"
fi
EFFICIENTDET_URL="https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/latest/efficientdet_lite0.tflite"
EFFICIENTDET_SHA256="0720bf247bd76e6594ea28fa9c6f7c5242be774818997dbbeffc4da460c723bb"
EFFICIENTDET_PATH="$DEST/efficientdet_lite0.tflite"
if [[ ! -f "$EFFICIENTDET_PATH" ]]; then
  curl -fsSL -o "$EFFICIENTDET_PATH" "$EFFICIENTDET_URL"
fi
echo "${EFFICIENTDET_SHA256}  ${EFFICIENTDET_PATH}" | sha256sum -c -
echo "models ready in $DEST"
