#!/usr/bin/env python3
"""render_editable worker step: portrait.autoFocalPoint. MediaPipe BlazeFace (local model, deterministic, no network, no AI service).
usage: face_focal.py <image> <model.tflite>  -> stdout JSON {"focalPoint":{x,y}, "faces":n, "score":s}"""
import sys, json
import mediapipe as mp
from mediapipe.tasks.python import vision, BaseOptions
img, model = sys.argv[1], sys.argv[2]
det = vision.FaceDetector.create_from_options(vision.FaceDetectorOptions(base_options=BaseOptions(model_asset_path=model), min_detection_confidence=0.5))
im = mp.Image.create_from_file(img); r = det.detect(im); W, H = im.width, im.height; det.close()
if not r.detections: print(json.dumps({"focalPoint": None, "faces": 0})); sys.exit(0)
d = max(r.detections, key=lambda d: d.bounding_box.width * d.bounding_box.height); b = d.bounding_box
print(json.dumps({"focalPoint": {"x": round((b.origin_x + b.width / 2) / W, 4), "y": round((b.origin_y + b.height * 0.45) / H, 4)}, "faces": len(r.detections), "score": round(d.categories[0].score, 3)}))
