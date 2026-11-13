#!/usr/bin/env python3
"""Validate a system-viz-3d model.

Usage:
    python3 validate.py model.json [--json]

Exit status is 1 when there are errors. Warnings never fail the run.
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

SHORT_LABEL_MAX = 34


def validate(raw):
    errors, warnings = [], []
    if raw.get("schema") != common.SCHEMA_ID:
        warnings.append('"schema" should be "%s"' % common.SCHEMA_ID)
    m = common.normalise(raw)
    v = m["vocab"]
    zones = {z.get("id") for z in m["zones"]}
    floors = {f.get("id") for f in m["floors"]}
    groups = {g.get("id"): g for g in m["groups"]}
    envs = set((v.get("envs") or {}).keys())

    seen = {}
    for kind, items in (("group", m["groups"]), ("node", m["nodes"])):
        for it in items:
            iid = it.get("id")
            if not iid or not isinstance(iid, str):
                errors.append("%s without a string id: %s" % (kind, json.dumps(it)[:80]))
                continue
            if iid in seen:
                errors.append('duplicate id "%s" (%s and %s)' % (iid, seen[iid], kind))
            seen[iid] = kind
    ids = set(seen)

    def ref(where, val, pool, what):
        if val not in pool:
            errors.append('%s: unknown %s "%s"' % (where, what, val))

    for z in m["zones"]:
        if not z.get("id"):
            errors.append("zone without id")
    for f in m["floors"]:
        if not isinstance(f.get("level", 0), (int, float)):
            errors.append('floor "%s": level must be a number' % f.get("id"))

    for g in m["groups"]:
        w = 'group "%s"' % g.get("id")
        ref(w, g["zone"], zones, "zone")
        ref(w, g["floor"], floors, "floor")
        if g.get("parent"):
            ref(w, g["parent"], groups, "parent group")
            par = groups.get(g["parent"])
            if par and (par["zone"], par["floor"]) != (g["zone"], g["floor"]):
                errors.append("%s: must be on the same zone and floor as its parent" % w)
        if g["style"] not in common.GROUP_STYLES:
            errors.append('%s: style must be one of %s' % (w, ", ".join(common.GROUP_STYLES)))
        ref(w, g["kind"], v["kinds"], "kind")
        ref(w, g["status"], v["status"], "status")
        if g.get("env") and envs:
            ref(w, g["env"], envs | {"shared"}, "env")
    for n in m["nodes"]:
        w = 'node "%s"' % n.get("id")
        ref(w, n["zone"], zones, "zone")
        ref(w, n["floor"], floors, "floor")
        if n.get("group"):
            ref(w, n["group"], groups, "group")
            par = groups.get(n["group"])
            if par and (par["zone"], par["floor"]) != (n["zone"], n["floor"]):
                errors.append("%s: must be on the same zone and floor as its group" % w)
        for r in common.as_list(n.get("replicas")):
            ref(w + " replicas", r, groups, "group")
        if n.get("kind") not in v["kinds"]:
            errors.append('%s: unknown kind "%s"' % (w, n.get("kind")))
        ref(w, n["status"], v["status"], "status")
        shape = n.get("shape") or (v["kinds"].get(n.get("kind")) or {}).get("shape", "box")
        if shape not in common.SHAPES:
            errors.append('%s: shape must be one of %s' % (w, ", ".join(common.SHAPES)))
        if n.get("env") and envs:
            ref(w, n["env"], envs | {"shared"}, "env")
        if len(n.get("short") or n.get("label", "")) > SHORT_LABEL_MAX:
            warnings.append('%s: label over %d characters; add a "short"' % (w, SHORT_LABEL_MAX))
        if n.get("confidence") and n["confidence"] not in v["confidence"]:
            errors.append('%s: unknown confidence "%s"' % (w, n["confidence"]))

    link_pairs = set()
    for i, l in enumerate(m["links"]):
        w = "link %d (%s -> %s)" % (i, l.get("from"), l.get("to"))
        ref(w, l.get("from"), ids, "from id")
        ref(w, l.get("to"), ids, "to id")
        if l["type"] not in v["linkTypes"]:
            warnings.append('%s: type "%s" is not in vocab.linkTypes' % (w, l["type"]))
        ref(w, l["status"], v["status"], "status")
        if l.get("confidence") and l["confidence"] not in v["confidence"]:
            errors.append('%s: unknown confidence "%s"' % (w, l["confidence"]))
        link_pairs.add((l.get("from"), l.get("to")))
        link_pairs.add((l.get("to"), l.get("from")))
    for i, gp in enumerate(m["gaps"]):
        w = "gap %d" % i
        ref(w, gp.get("from"), ids, "from id")
        ref(w, gp.get("to"), ids, "to id")

    flow_ids = set()
    for f in m["flows"]:
        w = 'flow "%s"' % f.get("id")
        if not f.get("id"):
            errors.append("flow without id")
        flow_ids.add(f.get("id"))
        if not f["paths"]:
            errors.append("%s: needs path or paths" % w)
        for p in f["paths"]:
            if len(p) < 2:
                errors.append("%s: a path needs at least two ids" % w)
            for x in p:
                ref(w, x, ids, "id")
        if f.get("status") and f["status"] not in v["status"]:
            errors.append('%s: unknown status "%s"' % (w, f["status"]))
        if not f.get("quote") and not f.get("source"):
            warnings.append("%s: no quote or source; say where the flow comes from" % w)

    b_ids = set()
    for b in m["boundaries"]:
        w = 'boundary "%s"' % b.get("id")
        b_ids.add(b.get("id"))
        if not b["members"] and not b.get("boxes"):
            errors.append("%s: needs members or boxes" % w)
        for x in b["members"]:
            ref(w, x, ids, "member")

    for iss in m["issues"]:
        w = 'issue "%s"' % iss.get("id")
        for x in iss["members"]:
            ref(w, x, ids, "member")
        for pair in iss["links"]:
            if not (isinstance(pair, list) and len(pair) == 2):
                errors.append("%s: links entries must be [from, to]" % w)
            elif tuple(pair) not in link_pairs:
                warnings.append("%s: no recorded link %s -> %s" % (w, pair[0], pair[1]))
        for nd in iss["needs"]:
            ref(w + " needs", nd.get("from"), ids, "from id")
            ref(w + " needs", nd.get("to"), ids, "to id")

    view_ids = {x.get("id") for x in m["views"]}
    for i, s in enumerate(m["steps"]):
        w = "step %d" % (i + 1)
        for x in s["focus"]:
            ref(w, x, ids, "focus id")
        for x in s["flows"]:
            if x != "all":
                ref(w, x, flow_ids, "flow")
        for x in s["boundaries"]:
            ref(w, x, b_ids, "boundary")
        if s.get("view") and s["view"] not in view_ids and not s["view"].startswith(("overview", "top", "floor:", "zone:")):
            errors.append('%s: unknown view "%s"' % (w, s["view"]))

    def missing_style(x):
        return (v["status"].get(x.get("status")) or {}).get("style") == "missing"
    for what, items, name in (("nodes", m["nodes"], lambda x: x["id"]), ("groups", m["groups"], lambda x: x["id"]),
                              ("links", m["links"], lambda x: "%s->%s" % (x.get("from"), x.get("to")))):
        no_src = [name(x) for x in items if not x.get("source") and not x.get("confidence") and not missing_style(x)]
        if no_src:
            warnings.append("%d of %d %s have no source or confidence (first: %s)" % (len(no_src), len(items), what, ", ".join(no_src[:5])))
    if not errors:
        import layout as layout_mod
        warnings.extend(layout_mod.layout(raw)["_layout"]["warnings"])
    return errors, warnings


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("model")
    ap.add_argument("--json", action="store_true", help="print the result as JSON")
    args = ap.parse_args()
    errors, warnings = validate(common.read_json(args.model))
    if args.json:
        print(json.dumps({"errors": errors, "warnings": warnings}, indent=2))
    else:
        for e in errors:
            print("ERROR   " + e)
        for w in warnings:
            print("warning " + w)
        print("%d error(s), %d warning(s)" % (len(errors), len(warnings)))
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
