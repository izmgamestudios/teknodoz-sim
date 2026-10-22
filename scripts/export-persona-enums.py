#!/usr/bin/env python3
"""Export the allowed values of the persona dimensions we support to shared/persona-enums.json (read-only on vendor/MatrAIx)."""
import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "vendor", "MatrAIx", "persona", "schema", "dimensions.json")
OUT = os.path.join(ROOT, "shared", "persona-enums.json")
FIELDS = ["age_bracket", "gender_identity", "region", "life_stage", "economic_motivation", "risk_tolerance",
          "demo_employment_status", "socioeconomic_band", "urbanicity"]

raw = json.load(open(SRC, encoding="utf-8"))
items = raw if isinstance(raw, list) else raw["dimensions"]
by = {x["id"]: x for x in items}
out = {f: by[f]["values"] for f in FIELDS}
out["languages"] = sorted(x["id"].removeprefix("lang_") for x in items if x["id"].startswith("lang_"))
out["primary_language"] = by["primary_language"]["values"]
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print({k: len(v) for k, v in out.items()})
