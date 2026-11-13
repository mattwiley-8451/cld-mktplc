# system-viz-3d

A Claude skill that turns a description of a system into a single, shareable HTML file with an interactive 3D view: components, groupings, links, data flows, security boundaries, environments, issues and a guided walkthrough. Every object and line can be clicked for an explanation, including where each fact came from.

The output works offline and opens from disk, so you can email it or attach it anywhere. There's a 2D view for screens without 3D support.

## Install

Requires Python 3.8 or later. No packages to install.

```
/plugin marketplace add mattwiley-8451/cld-mktplc
/plugin install system-viz-3d@cld-mktplc
```

Or in one step on Claude Code 2.1.275 or later:

```
/plugin install system-viz-3d --marketplace mattwiley-8451/cld-mktplc
```

Start a new session, then ask Claude "what skills do you have?" and look for `system-viz-3d`.

## Try it

Ask Claude something like:

> Make an interactive 3D architecture view of our order service: two Azure subscriptions (dev and prod), each with an AKS cluster running the web app and API, a Postgres database and a Key Vault, calling Stripe through an egress rule. Show the trust boundaries and the checkout flow.

Claude writes a JSON model, validates it, builds the HTML and tells you where it is.

To build by hand:

```bash
# <skill> is skills/system-viz-3d inside the installed plugin
python3 <skill>/scripts/build.py <skill>/examples/northwind-orders.json -o northwind.html
open northwind.html
```

## Using the viewer

- Drag to rotate, shift-drag or right-drag to pan, scroll to zoom.
- Click anything (objects, lines, flows) for its explanation panel. Esc clears.
- **Links: On selection** shows only the lines for what you've selected; switch to **All** to see everything.
- **Display:** Solid makes objects opaque; Glass and Lines sliders reduce clutter.
- **Issues** (when the model has them) lists findings; selecting one shows problem links in red and needed links in purple.
- **Play the walkthrough** (when the model has steps) steps through the story; use the arrow keys.

## Before you share an output

The HTML contains the whole model. Check it for secret names, internal hostnames, IP addresses and account or group ids before sending it outside your team. Ask Claude for a redacted copy if needed.

## Feedback

This is an early version shared for testing. Note what was confusing, what the layout got wrong, and what you wanted to show but couldn't, and send it to Matt Wiley.

Three.js r147 is bundled under its MIT licence (`assets/vendor/three-LICENSE.txt`).
