#!/usr/bin/env python3
"""Check a built system-viz-3d HTML file without a browser.

Usage:
    python3 check_html.py system.html

Checks that the file is self-contained, that the embedded model parses and
is laid out, and that every reference in it resolves. If Node.js is on the
PATH it also syntax-checks the inline scripts. A clean result does not prove
the page renders; open it, or load it in a headless browser, for that.
Exit status is 1 when a check fails.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("html")
    args = ap.parse_args()
    with open(args.html, encoding="utf-8") as f:
        page = f.read()
    problems, notes = [], []

    if re.search(r'<script[^>]+src=|<link[^>]+href=|@import', page):
        problems.append("loads an external script or stylesheet, so it will not work offline")
    if "/*__" in page or "__TITLE__" in page:
        problems.append("template placeholders were not replaced")
    scripts = re.findall(r"<script>(.*?)</script>", page, re.S)
    if len(scripts) != 3:
        problems.append("expected 3 inline scripts (Three.js, model, engine), found %d" % len(scripts))

    model = None
    for s in scripts:
        if s.startswith("const MODEL="):
            try:
                model = json.loads(s[len("const MODEL="):].rstrip().rstrip(";").replace("<\\/", "</").replace("<\\!--", "<!--"))
            except json.JSONDecodeError as e:
                problems.append("embedded model is not valid JSON: %s" % e)
    if model is None and not any("embedded model" in p for p in problems):
        problems.append("no embedded model found")

    if model:
        ids = {x["id"] for x in model.get("groups", []) + model.get("nodes", [])}
        unplaced = [x["id"] for x in model.get("groups", []) + model.get("nodes", []) if "box" not in x]
        if "_layout" not in model:
            problems.append("model was not laid out")
        if unplaced:
            problems.append("items without a position: " + ", ".join(unplaced[:8]))
        refs = [(l.get("from"), l.get("to")) for l in model.get("links", []) + model.get("gaps", [])]
        bad = sorted({x for pair in refs for x in pair if x not in ids})
        bad += sorted({x for f in model.get("flows", []) for p in f.get("paths", []) for x in p if x not in ids})
        if bad:
            problems.append("references to unknown ids: " + ", ".join(bad[:8]))
        notes.append("%d groups, %d nodes, %d links, %d flows, %d boundaries, %d issues, %d steps" % (
            len(model.get("groups", [])), len(model.get("nodes", [])), len(model.get("links", [])), len(model.get("flows", [])),
            len(model.get("boundaries", [])), len(model.get("issues", [])), len(model.get("steps", []))))
        for w in (model.get("_layout") or {}).get("warnings", []):
            notes.append("layout warning: " + w)

    node = shutil.which("node")
    if node and len(scripts) == 3:
        with tempfile.TemporaryDirectory() as tmp:
            for i, s in enumerate(scripts):
                path = os.path.join(tmp, "s%d.js" % i)
                with open(path, "w", encoding="utf-8") as f:
                    f.write(s)
                r = subprocess.run([node, "--check", path], capture_output=True, text=True)
                if r.returncode != 0:
                    problems.append("inline script %d has a syntax error: %s" % (i + 1, (r.stderr or "").strip().splitlines()[-1:]))
        notes.append("inline scripts syntax-checked with Node.js")
    else:
        notes.append("Node.js not found; inline scripts were not syntax-checked")

    for n in notes:
        print("note    " + n)
    for p in problems:
        print("PROBLEM " + p)
    print("%d problem(s); %d KB" % (len(problems), len(page.encode("utf-8")) // 1024))
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
