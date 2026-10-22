#!/usr/bin/env python3
"""Statically validate MatrAIx survey task folders (no MatrAIx code is executed).

Rules mirror MatrAIx application/playground/backend/service/survey_types.py and the reference task
application/tasks/example-survey_product-feedback. Usage: python3 -I scripts/validate-survey-task.py DIR [DIR...]
Each DIR is a task folder. Exit code 1 on any problem.
"""
import filecmp
import json
import os
import sys
import tomllib

import yaml

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
TESTS = os.path.join(ROOT, "scripts", "survey-tests")
REQUIRED = {"README.md", "instruction.md", "persona_strategy.json", "reporting.json", "task.toml",
            "input/context.md", "input/questionnaire.yaml", "tests/test.sh", "tests/test_state.py", "tests/verifier_env.sh"}
OPTIONAL = {"README.md"}  # README is optional for generated study tasks
TYPES = {"likert", "single_choice", "multi_choice", "free_text"}


def check(task_dir):
    errors = []
    files = {os.path.relpath(os.path.join(d, f), task_dir).replace(os.sep, "/") for d, _, fs in os.walk(task_dir) for f in fs}
    missing = (REQUIRED - OPTIONAL) - files
    if missing:
        errors.append(f"missing files: {sorted(missing)}")
    extra = files - REQUIRED
    if extra:
        errors.append(f"unexpected files: {sorted(extra)}")
    for f in ("test.sh", "verifier_env.sh", "test_state.py"):
        p = os.path.join(task_dir, "tests", f)
        if os.path.isfile(p) and not filecmp.cmp(p, os.path.join(TESTS, f), shallow=False):
            errors.append(f"tests/{f} differs from the reference verifier")
    try:
        toml = tomllib.load(open(os.path.join(task_dir, "task.toml"), "rb"))
        assert toml["metadata"]["type"] == "survey"
        assert toml["environment"]["definition"] == "application/shared-survey-form"
        assert toml["artifacts"] == ["/app/output"]
    except Exception as e:  # noqa: BLE001
        errors.append(f"task.toml: {e!r}")
    for j in ("persona_strategy.json", "reporting.json"):
        try:
            json.load(open(os.path.join(task_dir, j), encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            errors.append(f"{j}: {e!r}")
    try:
        q = yaml.safe_load(open(os.path.join(task_dir, "input", "questionnaire.yaml"), encoding="utf-8"))
        assert q["schemaVersion"] == "1.0" and q["id"] and q["title"]
        ids = [x["id"] for x in q["questions"]]
        if not ids or len(ids) != len(set(ids)):
            errors.append("question ids empty or duplicated")
        for x in q["questions"]:
            if x["type"] not in TYPES:
                errors.append(f"{x['id']}: bad type {x['type']}")
            if not x.get("prompt") or not x.get("construct"):
                errors.append(f"{x['id']}: missing prompt/construct")
            if x["type"] == "likert" and not (isinstance(x.get("minValue"), int) and isinstance(x.get("maxValue"), int) and x["minValue"] < x["maxValue"]):
                errors.append(f"{x['id']}: likert range")
            if x["type"] in ("single_choice", "multi_choice"):
                oi = [o["id"] for o in x.get("options", [])]
                if len(oi) < 2 or len(oi) != len(set(oi)) or not all(isinstance(i, str) and i for i in oi):
                    errors.append(f"{x['id']}: options {oi}")
    except Exception as e:  # noqa: BLE001
        errors.append(f"questionnaire.yaml: {e!r}")
    return errors


def main():
    bad = 0
    for d in sys.argv[1:]:
        errs = check(d)
        print(("FAIL " if errs else "OK   ") + os.path.basename(d.rstrip('/')), *errs, sep="\n  " if errs else "")
        bad += bool(errs)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
