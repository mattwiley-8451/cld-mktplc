#!/usr/bin/env python3
"""Smoke test for system-viz-3d: build every example and check the output.

Usage:
    python3 tests/smoke_test.py

Checks, per example:
- the model validates with no errors
- the build succeeds and writes one self-contained HTML file
- the page holds the model, the engine and Three.js, and no external script or stylesheet
- every node and group has a computed box, and every boundary has at least one box
- a broken model is rejected

Uses only the standard library. Exits 1 on the first failure.
"""
import glob
import json
import os
import re
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(SKILL, "scripts"))
import build  # noqa: E402
import validate  # noqa: E402


def check(cond, msg):
    if not cond:
        print("FAIL " + msg)
        sys.exit(1)
    print("ok   " + msg)


def main():
    examples = sorted(glob.glob(os.path.join(SKILL, "examples", "*.json")))
    check(examples, "examples found (%d)" % len(examples))
    for path in examples:
        name = os.path.basename(path)
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
        errors, _ = validate.validate(raw)
        check(not errors, "%s validates (%s)" % (name, "; ".join(errors) or "no errors"))
        page, laid = build.build(raw)
        check(page.startswith("<!DOCTYPE html>"), name + " builds an HTML page")
        check("const MODEL=" in page and "SV3D" in page and "THREE" in page, name + " inlines model, engine and Three.js")
        check(not re.search(r'<script[^>]+src=|<link[^>]+href=', page), name + " has no external scripts or stylesheets")
        check("__TITLE__" not in page and "/*__" not in page, name + " has no leftover placeholders")
        unplaced = [x["id"] for x in laid["groups"] + laid["nodes"] if "box" not in x]
        check(not unplaced, name + " places every group and node" + (" (missing: %s)" % unplaced if unplaced else ""))
        empty = [b["id"] for b in laid["boundaries"] if not b.get("boxes")]
        check(not empty, name + " gives every boundary a box")
        with tempfile.TemporaryDirectory() as tmp:
            out = os.path.join(tmp, "out.html")
            with open(out, "w", encoding="utf-8") as f:
                f.write(page)
            check(os.path.getsize(out) > 500_000, name + " output includes the bundled Three.js")

    bad = {"schema": "system-viz-3d/1", "nodes": [{"id": "a", "kind": "app"}, {"id": "a", "kind": "nope"}],
           "links": [{"from": "a", "to": "ghost"}]}
    errors, _ = validate.validate(bad)
    check(any("duplicate id" in e for e in errors), "validator catches duplicate ids")
    check(any('unknown kind "nope"' in e for e in errors), "validator catches unknown kinds")
    check(any('"ghost"' in e for e in errors), "validator catches links to unknown ids")
    print("all checks passed")


if __name__ == "__main__":
    main()
