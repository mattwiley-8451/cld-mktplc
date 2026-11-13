#!/usr/bin/env python3
"""Build a self-contained interactive 3D HTML file from a system-viz-3d model.

Validates the model, lays it out, and inlines the model, the viewer and
Three.js into one HTML file that works offline and from disk.

Usage:
    python3 build.py model.json -o system.html
    python3 build.py model.json -o system.html --dump-layout laid-out.json
"""
import argparse
import html
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402
import layout as layout_mod  # noqa: E402
import validate as validate_mod  # noqa: E402


def read_asset(*parts):
    path = os.path.join(common.ASSETS, *parts)
    with open(path, encoding="utf-8") as f:
        return f.read()


def script_safe(text):
    """Make text safe to place inside a <script> element."""
    return text.replace("</", "<\\/").replace("<!--", "<\\!--")


def build(raw, skip_validate=False):
    if not skip_validate:
        errors, warnings = validate_mod.validate(raw)
        for w in warnings:
            sys.stderr.write("warning " + w + "\n")
        if errors:
            for e in errors:
                sys.stderr.write("ERROR   " + e + "\n")
            common.die("%d validation error(s); fix them or pass --skip-validate" % len(errors))
    laid = layout_mod.layout(raw)
    title = (laid.get("meta") or {}).get("title") or "System architecture"
    page = read_asset("template.html")
    parts = {
        "__TITLE__": html.escape(title),
        "/*__THREE__*/": read_asset("vendor", "three.min.js"),
        "/*__MODEL__*/": "const MODEL=" + script_safe(json.dumps(laid, ensure_ascii=False)) + ";",
        "/*__ENGINE__*/": read_asset("engine.js"),
    }
    for key, val in parts.items():
        if page.count(key) != 1:
            common.die("template placeholder %s missing or repeated" % key)
        page = page.replace(key, val)
    return page, laid


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("model")
    ap.add_argument("-o", "--out", required=True, help="output HTML file")
    ap.add_argument("--dump-layout", help="also write the laid-out model as JSON")
    ap.add_argument("--skip-validate", action="store_true")
    args = ap.parse_args()
    page, laid = build(common.read_json(args.model), args.skip_validate)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(page)
    if args.dump_layout:
        with open(args.dump_layout, "w", encoding="utf-8") as f:
            json.dump(laid, f, indent=1)
    print("wrote %s (%d KB): %d groups, %d nodes, %d links, %d flows, %d boundaries, %d issues, %d steps" % (
        args.out, len(page.encode("utf-8")) // 1024, len(laid["groups"]), len(laid["nodes"]), len(laid["links"]),
        len(laid["flows"]), len(laid["boundaries"]), len(laid["issues"]), len(laid["steps"])))


if __name__ == "__main__":
    main()
