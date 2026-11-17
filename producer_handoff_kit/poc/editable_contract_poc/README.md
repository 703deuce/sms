# Editable-elements contract POC (S01, keith_murray_doc_2min)
Read CONTRACT.md first.

Reproduce (no paid calls, no network):
    node render.mjs --version project/versions/v1.json --scene S01 --out out/S01_original_props.mp4 --report out/S01_original_props.report.json
    node render.mjs --version project/versions/v1.json --scene S01 --overrides variants/A_midnight_playfair.json --out out/S01_variant_A.mp4
    node render.mjs --version project/versions/v1.json --scene S01 --overrides variants/B_paper_anton.json --out out/S01_variant_B.mp4
    node render.mjs --version project/versions/v1.json --scene S01 --overrides variants/C_invalid.json --validate-only   # exits 3, 10 errors
    node preview_test.mjs                          # live setProps proof -> out/preview/
    /tmp/jsv/bin/python tools/validate_json.py     # JSON Schema check (venv with jsonschema)

qa_evidence/: fresh capture of the untouched production S01 bundle vs the parameterized one (used for the pixel comparison), and SSIM logs.
node_modules is a symlink to /workspace/motion_engines/_capture/node_modules (puppeteer-core, serve-handler).
