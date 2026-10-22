#!/usr/bin/env python3
"""Export the questionnaires of MatrAIx's built-in survey tasks to shared/questionnaires.builtin.json.

Used by the report/results views to label option ids. Requires vendor/MatrAIx (read-only; nothing is executed).
Usage: python3 -I scripts/export-builtin-questionnaires.py
"""
import glob
import json
import os

import yaml

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
TASKS = os.path.join(ROOT, "vendor", "MatrAIx", "application", "tasks")
OUT = os.path.join(ROOT, "shared", "questionnaires.builtin.json")

out = {}
for path in sorted(glob.glob(os.path.join(TASKS, "*", "input", "questionnaire.yaml"))):
    task_id = path.split(os.sep)[-3]
    q = yaml.safe_load(open(path, encoding="utf-8"))
    questions = []
    for x in q["questions"]:
        item = {"id": x["id"], "prompt": x["prompt"], "type": x["type"]}
        if x["type"] == "likert":
            item["minValue"] = x.get("minValue", 1)
            item["maxValue"] = x.get("maxValue", 5)
        if x["type"] in ("single_choice", "multi_choice"):
            item["options"] = [{"id": str(o["id"]), "label": o["label"]} for o in x["options"]]
        out[task_id] = out.get(task_id, {"title": q.get("title", task_id), "questions": []})
        questions.append(item)
    out[task_id]["questions"] = questions

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(f"{len(out)} built-in survey tasks -> shared/questionnaires.builtin.json")
