"""Shared model loading, defaults and normalisation for system-viz-3d.

Standard library only, so the skill runs anywhere Python 3.8+ runs.
"""
import copy
import json
import os
import sys

SCHEMA_ID = "system-viz-3d/1"

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(SKILL_DIR, "assets")

SHAPES = ("box", "tower", "cyl", "oct", "actor", "gate")
GROUP_STYLES = ("glass", "slab", "plate")
STATUS_STYLES = ("solid", "glass", "ghost", "missing")

DEFAULT_VOCAB = {
    "status": {
        "approved": {"label": "Approved", "style": "solid"},
        "planned": {"label": "Planned or unapproved", "style": "glass"},
        "unknown": {"label": "Unknown or assumed", "style": "ghost", "toggle": "Unknowns"},
        "missing": {"label": "Missing: needed, not in source", "style": "missing", "toggle": "Issues"},
    },
    "kinds": {
        "person": {"label": "Person or actor", "color": "#85B7EB", "shape": "actor"},
        "app": {"label": "Application", "color": "#5DCAA5", "shape": "tower"},
        "compute": {"label": "Compute", "color": "#1D9E75", "shape": "box"},
        "data": {"label": "Data store", "color": "#7F77DD", "shape": "cyl"},
        "secret": {"label": "Secrets", "color": "#AFA9EC", "shape": "box"},
        "identity": {"label": "Identity and access", "color": "#378ADD", "shape": "oct"},
        "network": {"label": "Network", "color": "#D85A30", "shape": "gate"},
        "external": {"label": "External service", "color": "#D4537E", "shape": "box"},
        "shared": {"label": "Shared platform service", "color": "#888780", "shape": "box"},
        "governance": {"label": "Governance", "color": "#B4B2A9", "shape": "box"},
        "container": {"label": "Container or grouping", "color": "#5F5E5A", "shape": "box"},
    },
    "linkTypes": {
        "hosting": {"label": "Hosting and placement", "explain": "The source runs on, or is placed in, the target."},
        "identity": {"label": "Identity use", "explain": "The source authenticates as, or acts through, the target identity."},
        "secrets": {"label": "Secrets", "explain": "The source can read secrets or keys from the target."},
        "data": {"label": "Data access", "explain": "The source reads or writes data in the target."},
        "access": {"label": "People and accounts", "explain": "People or accounts in the source are granted access to the target."},
        "calls": {"label": "Service calls", "explain": "The source calls the target's API or service."},
        "logging": {"label": "Logging and telemetry", "explain": "The source sends logs, metrics or traces to the target."},
        "network": {"label": "Network", "explain": "A network rule or path between the source and the target."},
        "governance": {"label": "Governance", "explain": "A policy, classification or approval relationship."},
        "other": {"label": "Other", "explain": ""},
    },
    "confidence": {
        "recorded": "Recorded in the source",
        "stated": "Stated by the team, not in the source",
        "inferred": "Inference from recorded facts",
    },
    "envs": {},
}


def die(msg):
    sys.stderr.write("error: " + msg + "\n")
    sys.exit(1)


def read_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        die("%s is not valid JSON: line %d column %d: %s" % (path, e.lineno, e.colno, e.msg))
    except OSError as e:
        die("cannot read %s: %s" % (path, e))


def merge_vocab(model):
    """Return the model's vocab with defaults filled in for any missing section.

    A section the model provides replaces the default section entirely, so a model
    can define a closed vocabulary (for example only its own statuses).
    """
    vocab = copy.deepcopy(DEFAULT_VOCAB)
    for key, val in (model.get("vocab") or {}).items():
        vocab[key] = val
    return vocab


def as_list(x):
    if x is None:
        return []
    return x if isinstance(x, list) else [x]


def normalise(model):
    """Fill defaults and inherited fields without changing what the author wrote."""
    m = copy.deepcopy(model)
    m["vocab"] = merge_vocab(model)
    m.setdefault("meta", {})
    m.setdefault("zones", [{"id": "main", "label": m["meta"].get("title", "System")}])
    m.setdefault("floors", [{"id": "ground", "label": "Ground", "level": 0}])
    for key in ("groups", "nodes", "links", "gaps", "flows", "boundaries", "issues", "steps", "views"):
        m.setdefault(key, [])
    zone0 = m["zones"][0]["id"]
    floor0 = sorted(m["floors"], key=lambda f: abs(f.get("level", 0)))[0]["id"]
    groups = {g.get("id"): g for g in m["groups"]}

    def inherit(item, seen=()):
        par = groups.get(item.get("parent") or item.get("group"))
        if par is not None and par.get("id") not in seen:
            inherit(par, seen + (par.get("id"),))
            item.setdefault("zone", par.get("zone"))
            item.setdefault("floor", par.get("floor"))
        item.setdefault("zone", zone0)
        item.setdefault("floor", floor0)

    for g in m["groups"]:
        inherit(g)
        g.setdefault("style", "glass")
        g.setdefault("kind", "container")
        g.setdefault("status", first_status(m["vocab"], "solid"))
    for n in m["nodes"]:
        inherit(n)
        n.setdefault("status", first_status(m["vocab"], "solid"))
    for f in m["flows"]:
        if "paths" not in f:
            f["paths"] = [f["path"]] if "path" in f else []
    for i, l in enumerate(m["links"]):
        l.setdefault("type", "other")
        l.setdefault("status", first_status(m["vocab"], "solid"))
    for s in m["steps"]:
        for key in ("focus", "flows", "boundaries"):
            s[key] = as_list(s.get(key))
    for iss in m["issues"]:
        for key in ("members", "links", "needs", "records", "fix"):
            iss[key] = as_list(iss.get(key))
    for b in m["boundaries"]:
        b["members"] = as_list(b.get("members"))
        for key in ("records", "open"):
            b[key] = as_list(b.get(key))
    return m


def first_status(vocab, style):
    for key, val in vocab["status"].items():
        if (val or {}).get("style") == style:
            return key
    return next(iter(vocab["status"]))


def entity_ids(m):
    return [g["id"] for g in m["groups"]] + [n["id"] for n in m["nodes"]]
