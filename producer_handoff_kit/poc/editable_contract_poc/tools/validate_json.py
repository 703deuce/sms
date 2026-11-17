#!/usr/bin/env python3
"""Validate the POC JSON files against their JSON Schemas (Draft 2020-12)."""
import json, jsonschema, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + '/'
L = lambda p: json.load(open(R + p))
pairs = [('bundle/S01/editable-elements.json', 'schemas/editable-elements.schema.json'), ('project/theme.json', 'schemas/theme.schema.json'),
         ('variants/A_midnight_playfair.json', 'schemas/scene-overrides.schema.json'), ('variants/B_paper_anton.json', 'schemas/scene-overrides.schema.json'),
         ('variants/C_invalid.json', 'schemas/scene-overrides.schema.json')]
ok = True
for doc, sch in pairs:
    s = L(sch); jsonschema.Draft202012Validator.check_schema(s)
    errs = list(jsonschema.Draft202012Validator(s).iter_errors(L(doc)))
    ok &= not errs
    print(doc, 'VALID' if not errs else [e.message[:160] + ' @ ' + '/'.join(map(str, e.path)) for e in errs[:6]])
raise SystemExit(0 if ok else 1)
