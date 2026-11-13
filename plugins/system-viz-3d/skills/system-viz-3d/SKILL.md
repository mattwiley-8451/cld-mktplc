---
name: system-viz-3d
description: Build a self-contained, interactive 3D HTML visualization of a system or application architecture, showing components, containers, links, data flows, security and trust boundaries, environments, issues and a guided walkthrough, from a JSON model. Use this whenever someone wants to visualize, diagram, map or explain an architecture, a security plan, a cloud or Kubernetes deployment, a tenant or vendor boundary, a data flow or a threat model, especially when they want something interactive, explorable, 3D or shareable as a single file, or when a flat diagram is too busy. Also use it to turn a design doc, security plan, architecture review, Terraform description or conversation into an explorable model that marks what is recorded, stated or inferred.
---

# system-viz-3d

Turns a JSON model of a system into one HTML file with an interactive 3D scene. The file works offline, opens from disk and needs nothing installed, so it can be emailed or attached anywhere.

The viewer gives readers:
- zones side by side (tenants, accounts, vendors) and floors stacked vertically (identity, runtime, governance)
- groups (resource groups, clusters, subscriptions) that size themselves around their contents
- clickable objects and clickable lines, each with a panel explaining what it is, where the fact came from, and which boundaries a connection crosses
- animated flows, security boundaries, an environment filter, issue markers, a guided walkthrough, camera presets, display controls and a flat 2D fallback

You write the model; the scripts validate it, lay it out and build the page. You never place coordinates by hand.

## Workflow

1. **Gather the source.** Read the design doc, security plan, inventory or conversation. Note the scope the user wants: what is in, what is out.
2. **Write the model** as `<name>.json`. Read `references/model-reference.md` before writing your first model; it explains every field and how layout behaves. `examples/northwind-orders.json` is a full worked example with environments, issues and a walkthrough; `examples/aws-shop-conversation.json` was built from nothing but a user's description, so it shows `stated` and `inferred` provenance and a suspected issue; `examples/minimal.json` is the smallest useful model.
3. **Validate:** `python3 <skill>/scripts/validate.py <name>.json`. Fix every error. Read the warnings: most point at a missing source or a boundary box that contains things that are not members.
4. **Build:** `python3 <skill>/scripts/build.py <name>.json -o <name>.html`. It validates again, so a model with errors does not build.
5. **Check the result.** Run `python3 <skill>/scripts/check_html.py <name>.html`, which checks the file is self-contained and its references resolve, without a browser. Then open it (on macOS, `open <name>.html`). If you can drive a headless browser, load the file and confirm there are no console errors, the expected objects exist, and clicking an object, a link and an issue opens its panel. A local HTTP server may be needed, because some headless browsers refuse `file://`.
6. **Iterate** with the user: reorder items in the model to change the layout, shorten labels, add steps or views. Rebuild after each change.

`<skill>` is this skill's directory. The scripts use only the Python 3.8+ standard library.

## Building the model well

The value of the visualization comes from the model being honest about what is known. Keep these in mind:

- **Separate recorded facts from everything else.** Give nodes, links and flows a `source` and a `confidence`: `recorded` (in the source), `stated` (the team said so) or `inferred` (your reading). Readers use this to decide what to trust, especially in architecture and security reviews. When the user's description is the only source, mark what they said `stated` and what you added `inferred`.
- **Draw flows only where something states them.** Links are structure the source records; flows are claims about behaviour. Put the source's own words in `quote`. If you think a flow exists but nothing states it, say so in the conversation rather than drawing it, or mark it `inferred`.
- **Model what is absent, not just what is present.** Use `gaps` for links a reader would expect but the source lacks, nodes with a `missing`-style status for things that should exist, and `issues` to tie problem links, needed links and missing items together with a cause and a fix.
- **Use the vocabulary of the domain.** The default statuses (approved, planned, unknown, missing), kinds and link types suit most cloud systems. For something else (a threat model, a migration plan, a data pipeline), define `vocab.status`, `vocab.kinds` and `vocab.linkTypes` so the labels read naturally.
- **Pick zones and floors for the reader's question.** Zones answer "whose is this?" (tenant, account, vendor). Floors answer "what layer?" (identity above, runtime on the ground, governance below). Two zones and three floors cover most security reviews; use one of each for a simple app.
- **Use environments when they matter.** If dev and prod should be separate, set `vocab.envs` and tag items with `env`. Cross-environment links are then called out in every link panel, which is often where the real findings are.
- **Order controls layout.** Items are packed in list order inside their zone, floor and group, groups before loose nodes unless you set `order`. Put things that talk to each other next to each other, and keep each boundary's members together so its box does not swallow neighbours.
- **Keep 3D labels short.** Use `short` for the label in the scene and `label` for the full name in the panel.

When the source leaves something unclear, ask the user rather than guessing. A model that says "unknown" is more useful than one that is confidently wrong.

## Telling the user about the result

Say where the HTML file is, how to open it, and what to look at first: the walkthrough if there are steps, the Issues button if there are issues, otherwise a key object or boundary. Mention anything you could not verify.

## Sharing

The output inlines the whole model. Before the user shares it outside their team, point out anything sensitive in the model (secret names, internal hostnames, IP addresses, group or account ids) and offer to make a redacted copy of the model and rebuild.

## Files

- `scripts/validate.py`: checks ids, cross-references, vocabulary, flows and provenance; exits 1 on errors. `--json` prints machine-readable results.
- `scripts/layout.py`: computes positions; run it alone (`-o laid-out.json`) to inspect or debug the layout.
- `scripts/build.py`: validate, lay out and write the HTML. `--dump-layout` also writes the laid-out model.
- `scripts/check_html.py`: checks a built file without a browser (self-contained, model parses, references resolve, scripts parse when Node.js is available).
- `references/model-reference.md`: every field, the layout rules and modelling guidance.
- `references/model.schema.json`: JSON Schema for editor autocompletion.
- `examples/`: worked examples to copy from.
- `assets/`: the viewer template, the viewer engine and the bundled Three.js (MIT licence in `assets/vendor/three-LICENSE.txt`).
- `tests/smoke_test.py`: builds every example and checks the output; run it after changing the scripts or the engine.

## Troubleshooting

- **Only the 2D view shows:** the browser has WebGL turned off. The 2D view holds the same content.
- **Labels disappear when they overlap:** expected; the viewer hides lower-priority labels that would collide. Rotate or zoom, or select an item to give its labels priority.
- **The layout looks cramped or a group is in the wrong place:** change the order in the model, split a big group, or set `size` on an oversized node. `pin` is the last resort.
- **A flow or link is missing from the scene:** links show only for the current selection by default; switch Links to All. Items with a toggled status (for example Unknowns) and their links stay hidden until that layer is on.
