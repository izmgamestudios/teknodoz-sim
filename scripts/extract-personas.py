#!/usr/bin/env python3
"""Extract a compact persona catalog from the MatrAIx dev sample into shared/personas.json.

Source: vendor/MatrAIx/persona/datasets/matraix-persona-dev-sample (MatrAIx, MIT).
Usage:  python3 scripts/extract-personas.py
"""
import glob
import json
import os

import yaml

ROOT = os.path.join(os.path.dirname(__file__), "..")
SRC = os.path.join(ROOT, "vendor", "MatrAIx", "persona", "datasets", "matraix-persona-dev-sample")
OUT = os.path.join(ROOT, "shared", "personas.json")

GROUPS = {
    "profile": ["age_bracket", "region", "gender_identity", "life_stage", "demo_employment_status",
                "highest_education", "urbanicity", "socioeconomic_band", "primary_language"],
    "decision": ["economic_motivation", "risk_tolerance", "dominant_trait", "values_priority",
                 "lstyle_shopping_style", "time_pressure"],
    "style": ["tone_expected", "cog_formality", "cog_directness", "cog_patience", "cog_skepticism",
              "cog_optimism", "cog_curiosity", "cog_detail_orientation", "cog_decision_speed", "cog_politeness"],
}
VALUE_KEYS = ["val_career_success", "val_health", "val_security_stability", "val_tradition", "val_achievement",
              "val_community", "val_knowledge_truth", "val_justice_fairness", "val_loyalty",
              "val_helping_others", "val_personal_growth", "val_fun_enjoyment", "val_integrity_honesty"]
KEEP = [k for ks in GROUPS.values() for k in ks] + VALUE_KEYS


def main():
    personas = []
    for path in sorted(glob.glob(os.path.join(SRC, "persona_*.yaml"))):
        y = yaml.safe_load(open(path, encoding="utf-8"))
        dims = y.get("dimensions", {})
        d = {k: str(dims[k]) for k in KEEP if dims.get(k) not in (None, "null", "")}
        personas.append({
            "id": str(y["persona_id"]),
            "name": y.get("display_name", ""),
            "source": str(y.get("source", "")).split(":")[0],
            "d": d,
        })
    out = {"groups": GROUPS, "valueKeys": VALUE_KEYS, "personas": personas}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(personas)} personas -> {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT)//1024} KB)")


if __name__ == "__main__":
    main()
