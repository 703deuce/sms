# Robust Video Matting (RVM) — third-party notice
Used server-side only, in the Modal `Matter` job (worker/modal_app/matte.py). Not distributed to browsers, apps, or the worker image.
- Project: https://github.com/PeterL1n/RobustVideoMatting — licence GPL-3.0 (see LICENSE in this folder)
- Paper: Peter Lin, Linjie Yang, Imran Saleemi, Soumyadip Sengupta, "Robust High-Resolution Video Matting with Temporal Guidance", WACV 2022.
- Code: upstream commit 53d74c6826735f01f4406b5ca9075eee27bec094 (cloned unmodified into the Modal image at /opt/rvm).
- Weights: release v1.0.0 `rvm_mobilenetv3.pth` (sha256 3c7c1d92033f7c38d6577c481d13a195d7d80a159b960f4f3119ac7b534cf4f8),
  `rvm_resnet50.pth` (sha256 c191a807251164c073dce5fa408e7a816070d539b882b2a3150330a9fec112ce).
- Modifications: none to upstream code; our wrapper (matte.py) adds FP16 inference, chunking with pre-roll, and a 3-frame static-edge alpha median.
