#!/usr/bin/env python3
"""Automatic 3D layout for a system-viz-3d model.

Places every group and node so nobody has to hand-pick coordinates:
zones sit side by side along x, floors stack along y, and inside each
zone and floor the groups and nodes are packed into rows in the order the
model lists them. Groups grow to fit their children. Boundaries become
boxes around their members, one box per floor.

Usage:
    python3 layout.py model.json [-o laid-out.json]
"""
import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402

GAP = 4.0           # space between siblings
ZONE_PAD = 4.0      # margin inside a zone plane
ZONE_GAP = 10.0     # space between zones
FLOOR_GAP = 18.0    # height between floor levels
LABEL_STRIP = 2.5   # room at the back of a group for its label
BOUNDARY_PAD = 1.5
GROUP_PAD = {"glass": 3.0, "slab": 2.0, "plate": 3.0}
GROUP_INNER_BASE = {"glass": 0.0, "slab": 1.0, "plate": 0.4}
DEFAULT_SIZE = {
    "box": (4.0, 3.0, 4.0), "tower": (4.0, 7.0, 4.0), "cyl": (4.6, 3.6, 4.6),
    "oct": (2.6, 2.6, 2.6), "actor": (3.0, 3.0, 3.0), "gate": (1.0, 6.0, 8.0),
}


class Item:
    def __init__(self, kind, ref, w=0.0, d=0.0, h=0.0):
        self.kind, self.ref, self.w, self.d, self.h = kind, ref, w, d, h
        self.children = []
        self.total_h = h


def pack(items):
    """Row packing in list order. Returns ([(item, x, z)], width, depth)."""
    if not items:
        return [], 0.0, 0.0
    area = sum((it.w + GAP) * (it.d + GAP) for it in items)
    target = max(max(it.w for it in items), math.sqrt(area) * 1.3)
    out, x, z, row_d, width = [], 0.0, 0.0, 0.0, 0.0
    for it in items:
        if x > 0 and x + it.w > target:
            x, z, row_d = 0.0, z + row_d + GAP, 0.0
        out.append((it, x, z))
        width = max(width, x + it.w)
        x += it.w + GAP
        row_d = max(row_d, it.d)
    return out, width, z + row_d


def layout(raw):
    m = common.normalise(raw)
    v = m["vocab"]
    groups = {g["id"]: g for g in m["groups"]}
    nodes = {n["id"]: n for n in m["nodes"]}

    def node_item(n, kind="node"):
        shape = n.get("shape") or (v["kinds"].get(n.get("kind")) or {}).get("shape", "box")
        n["shape"] = shape
        w, h, d = n.get("size") or DEFAULT_SIZE.get(shape, DEFAULT_SIZE["box"])
        return Item(kind, n, float(w), float(d), float(h))

    def group_item(g):
        style = g["style"]
        it = Item("group", g)
        kids = ordered([(c, group_item(c)) for c in m["groups"] if c.get("parent") == g["id"]],
                       [(n, node_item(n)) for n in m["nodes"] if n.get("group") == g["id"] and not n.get("pin")])
        kids += [node_item(n, "rep") for n in m["nodes"] if g["id"] in common.as_list(n.get("replicas"))]
        it.children = kids
        placed, cw, cd = pack(kids)
        it.placed = placed
        pad = GROUP_PAD[style]
        it.w = max(cw + 2 * pad, 8.0)
        it.d = max(cd + 2 * pad + LABEL_STRIP, 6.0)
        tallest = max([k.total_h for k in kids] or [0.0])
        if style == "glass":
            it.h = max(tallest + 1.5, 3.0)
            it.total_h = it.h
        else:
            it.h = 1.0 if style == "slab" else 0.4
            it.total_h = GROUP_INNER_BASE[style] + tallest
        return it

    gidx = {g["id"]: i for i, g in enumerate(m["groups"])}
    nidx = {n["id"]: i for i, n in enumerate(m["nodes"])}

    def ordered(gpairs, npairs):
        """Groups before nodes in list order, unless an item sets "order"."""
        keyed = [(x.get("order", gidx[x["id"]]), it) for x, it in gpairs]
        keyed += [(x.get("order", 10000 + nidx[x["id"]]), it) for x, it in npairs]
        return [it for _, it in sorted(keyed, key=lambda p: p[0])]

    def place(it, x0, z0, y):
        if it.kind == "group":
            g = it.ref
            g["box"] = {"x": x0 + it.w / 2, "z": z0 + it.d / 2, "y": y, "w": it.w, "d": it.d, "h": it.h}
            pad = GROUP_PAD[g["style"]]
            cy = y + GROUP_INNER_BASE[g["style"]]
            for child, cx, cz in it.placed:
                place(child, x0 + pad + cx, z0 + pad + LABEL_STRIP + cz, cy)
        else:
            box = {"x": x0 + it.w / 2, "z": z0 + it.d / 2, "y": y, "w": it.w, "d": it.d, "h": it.h}
            if it.kind == "rep":
                it.ref.setdefault("reps", []).append(box)
            else:
                it.ref["box"] = box

    floor_y = {f["id"]: float(f.get("level", 0)) * FLOOR_GAP for f in m["floors"]}
    ground = sorted(m["floors"], key=lambda f: abs(f.get("level", 0)))[0]["id"]

    cells = {}
    for z in m["zones"]:
        for f in m["floors"]:
            items = ordered([(g, group_item(g)) for g in m["groups"] if not g.get("parent") and g["zone"] == z["id"] and g["floor"] == f["id"]],
                            [(n, node_item(n)) for n in m["nodes"] if not n.get("group") and not n.get("pin") and n["zone"] == z["id"] and n["floor"] == f["id"]])
            if items:
                cells[(z["id"], f["id"])] = pack(items)

    zone_rects, plates, x_cursor = {}, [], 0.0
    for z in m["zones"]:
        zc = [c for (zid, _), c in cells.items() if zid == z["id"]]
        width = max([c[1] for c in zc] or [12.0]) + 2 * ZONE_PAD
        depth = max([c[2] for c in zc] or [12.0]) + 2 * ZONE_PAD
        rect = [x_cursor, -depth / 2, x_cursor + width, depth / 2]
        zone_rects[z["id"]] = rect
        for f in m["floors"]:
            cell = cells.get((z["id"], f["id"]))
            if not cell:
                continue
            placed, cw, cd = cell
            ox = rect[0] + (width - cw) / 2
            oz = -cd / 2
            for it, px, pz in placed:
                place(it, ox + px, oz + pz, floor_y[f["id"]])
            if f["id"] != ground:
                plates.append({"zone": z["id"], "floor": f["id"], "rect": rect, "y": floor_y[f["id"]]})
        x_cursor += width + ZONE_GAP

    for n in m["nodes"]:
        if n.get("pin"):
            it = node_item(n)
            px, pz = n["pin"]
            place(it, px - it.w / 2, pz - it.d / 2, floor_y[n["floor"]])
        if "box" not in n:
            it = node_item(n)
            place(it, 0.0, 0.0, floor_y[n["floor"]])

    ents = {g["id"]: g for g in m["groups"]}
    ents.update(nodes)

    def descendants(gid):
        out = []
        for g in m["groups"]:
            if g.get("parent") == gid:
                out += [g["id"]] + descendants(g["id"])
        out += [n["id"] for n in m["nodes"] if n.get("group") == gid or gid in common.as_list(n.get("replicas"))]
        return out

    warnings = []
    for b in m["boundaries"]:
        expanded = []
        for mid in b["members"]:
            for x in [mid] + (descendants(mid) if mid in groups else []):
                if x not in expanded:
                    expanded.append(x)
        b["memberSet"] = expanded
        if b.get("boxes"):
            continue
        by_cell = {}
        for mid in expanded:
            e = ents.get(mid)
            if not e or "box" not in e:
                continue
            for bx in [e["box"]] + e.get("reps", []):
                by_cell.setdefault((e["floor"], e["zone"]), []).append([
                    bx["x"] - bx["w"] / 2 - BOUNDARY_PAD, bx["x"] + bx["w"] / 2 + BOUNDARY_PAD,
                    bx["z"] - bx["d"] / 2 - BOUNDARY_PAD, bx["z"] + bx["d"] / 2 + BOUNDARY_PAD,
                    bx["y"] - 0.3, bx["y"] + bx["h"] + 1.2])
        others = [n for n in m["nodes"] if n["id"] not in expanded and "box" in n]

        def swallowed(r, fid, zid):
            out = []
            for n in others:
                nb = n["box"]
                if n["floor"] == fid and n["zone"] == zid and r[0] < nb["x"] < r[1] and r[2] < nb["z"] < r[3]:
                    out.append(n["id"])
            return out

        boxes, inside = [], []
        for (fid, zid), rects in by_cell.items():
            merged = True
            while merged and len(rects) > 1:
                merged = False
                for i in range(len(rects)):
                    for j in range(i + 1, len(rects)):
                        a, c = rects[i], rects[j]
                        u = [min(a[0], c[0]), max(a[1], c[1]), min(a[2], c[2]), max(a[3], c[3]), min(a[4], c[4]), max(a[5], c[5])]
                        if not swallowed(u, fid, zid):
                            rects[i] = u
                            del rects[j]
                            merged = True
                            break
                    if merged:
                        break
            for r in rects:
                inside += swallowed(r, fid, zid)
                boxes.append([(r[0] + r[1]) / 2, (r[4] + r[5]) / 2, (r[2] + r[3]) / 2, r[1] - r[0], r[5] - r[4], r[3] - r[2]])
        b["boxes"] = boxes
        if inside:
            warnings.append('boundary "%s": a member\'s box also contains non-members %s; add them as members or set "boxes"' % (b["id"], ", ".join(sorted(set(inside))[:5])))

    xs = [r[0] for r in zone_rects.values()] + [r[2] for r in zone_rects.values()]
    zs = [r[1] for r in zone_rects.values()] + [r[3] for r in zone_rects.values()]
    ys = list(floor_y.values())
    m["_layout"] = {
        "zones": zone_rects, "floors": floor_y, "ground": ground, "plates": plates,
        "bounds": [min(xs), min(zs), max(xs), max(zs), min(ys), max(ys) + 8.0],
        "warnings": warnings,
    }
    return m


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("model")
    ap.add_argument("-o", "--out", help="write the laid-out model here (default: stdout)")
    args = ap.parse_args()
    out = json.dumps(layout(common.read_json(args.model)), indent=1)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(out)
    else:
        print(out)


if __name__ == "__main__":
    main()
