# system-viz-3d model reference

The model is one JSON file. Only `nodes` is required; everything else has defaults. `references/model.schema.json` is the machine-readable version of this page, useful for editor autocompletion.

Contents:
- Top level
- meta
- vocab (status, kinds, linkTypes, envs, confidence)
- zones and floors
- groups
- nodes
- links and gaps
- flows
- boundaries
- issues
- views and steps
- How layout works, and overrides
- Writing a good model


## Top level

```json
{
  "schema": "system-viz-3d/1",
  "meta": {},
  "vocab": {},
  "zones": [], "floors": [],
  "groups": [], "nodes": [],
  "links": [], "gaps": [], "flows": [],
  "boundaries": [], "issues": [],
  "views": [], "steps": []
}
```

Every `id` must be unique across groups and nodes. Ids are what links, flows, boundaries, issues and steps refer to, so keep them short and stable (`api_p`, `kv_np`).


## meta

| Field | Use |
|---|---|
| `title` | Page heading and browser title |
| `subtitle` | One line under the title |
| `source` | What the model was built from, shown in the header |
| `asOf` | When the source was read |
| `summary` | First paragraph of the side panel |
| `notes` | List of strings shown in the side panel |
| `issuesIntro` | Sentence at the top of the issue list, for example the standard the issues are measured against |


## vocab

Each section you provide replaces the default for that section, so you can define a closed vocabulary. Leave a section out to use the defaults below.

### status

Keyed by status id. Each status has a `label` and a `style`:

| style | How it draws | Typical use |
|---|---|---|
| `solid` | Opaque, normal edges | Approved, built, in production |
| `glass` | Translucent with amber dashed edges | Planned, unapproved, in progress |
| `ghost` | Grey wireframe | Unknown, assumed, team-stated but unrecorded |
| `missing` | Red dashed wireframe | Needed but absent; shown with the Issues layer |

Optional `toggle: "<name>"` puts every item with that status behind a toolbar toggle of that name (default off; set `toggleDefault: true` to start on). `toggle: "Issues"` ties it to the Issues layer instead.

Defaults: `approved` (solid), `planned` (glass), `unknown` (ghost, toggle "Unknowns"), `missing` (missing, toggle "Issues"). The first `solid` status is the default for nodes and links that do not set one.

### kinds

Keyed by kind id: `{"label", "color", "shape", "priority"}`. `shape` is the default for nodes of that kind: `box`, `tower`, `cyl`, `oct`, `actor` or `gate`. `priority` (default 20) decides which labels win when labels collide.

Defaults: `person` (actor), `app` (tower), `compute`, `data` (cyl), `secret`, `identity` (oct), `network` (gate), `external`, `shared`, `governance`, `container`.

### linkTypes

Keyed by type id: `{"label", "explain"}`. `explain` is the plain-language meaning shown in a link's panel unless the link has its own `explain`. Each type gets a filter checkbox in the legend.

Defaults: `hosting`, `identity`, `secrets`, `data`, `access`, `calls`, `logging`, `network`, `governance`, `other`.

### envs

Keyed by environment id: `{"label"}`, for example `{"np": {"label": "Non-prod"}, "p": {"label": "Prod"}}`. When present, the toolbar gets an environment filter, and links between different environments say so. Items without `env` are shared. Default: none.

### confidence

Keyed by id. The value is either the label, or `{"label", "style"}` where `style` is `solid` (green chip), `glass` (amber) or `ghost` (dashed). Defaults: `recorded` (in the source, green), `stated` (stated by the team, amber), `inferred` (inference, dashed). Ids without a style and not among the defaults get a neutral chip. Shown next to the source on every item that sets it.

When the only source is the user's own description, there is no separate document to record from: use `stated` for what they told you and `inferred` for what you added, and leave `recorded` for facts from documents or systems.


## zones and floors

**Zones** sit side by side along the ground: tenants, accounts, clouds, vendors, data centres. `{"id", "label", "color"}`; the first zone is the default.

**Floors** stack vertically: `{"id", "label", "level"}`. `level` is a number; 0 is the ground, positive floors float above, negative floors sit below. The floor whose level is closest to 0 is the default and is drawn as the zone planes; every other floor gets a translucent plate per zone.

Typical floors: identity and access above, runtime on the ground, governance below. Use one floor if the system does not need more.


## groups

Containers: resource groups, clusters, subscriptions, VPCs, namespaces, accounts.

| Field | Use |
|---|---|
| `id`, `label`, `short` | `short` is the 3D label; keep it under about 30 characters |
| `style` | `glass` (translucent volume, default), `slab` (platform the children stand on, good for clusters), `plate` (thin floor, good for subscriptions) |
| `parent` | Another group id; nesting can go several levels deep |
| `zone`, `floor` | Inherited from the parent when omitted |
| `kind`, `status`, `env` | As for nodes; `kind` defaults to `container` |
| `fields`, `notes`, `source`, `confidence`, `intent` | As for nodes |

A group's size is computed from its children; do not size groups by hand.


## nodes

| Field | Use |
|---|---|
| `id`, `label`, `short` | `label` is the full name shown in the panel |
| `kind` | Required; a key of `vocab.kinds` |
| `status` | A key of `vocab.status` |
| `group` | The group the node sits in; zone and floor are inherited from it |
| `zone`, `floor` | For nodes outside any group |
| `env` | A key of `vocab.envs`, or omit for shared |
| `shape` | Override the kind's shape |
| `size` | `[width, height, depth]`, only when the default looks wrong |
| `replicas` | List of group ids where a copy of the node also appears, for one deployment running in two clusters or regions |
| `fields` | List of `[name, value]` pairs shown as a table |
| `notes` | Observations, shown as a list |
| `intent` | What the intended design says about this item |
| `source`, `confidence` | Where the facts came from |
| `order` | Number that sets the packing order among siblings (see layout) |
| `pin` | `[x, z]` world position, skipping automatic layout (rarely needed) |


## links and gaps

**Links** are relationships the source records:

```json
{"from": "api_p", "to": "kv_p", "label": "Get secrets", "type": "secrets", "status": "approved",
 "explain": "optional, overrides the type's explanation", "note": "optional observation",
 "source": "Design doc, section 4", "confidence": "recorded"}
```

**Gaps** are links the source does not have but a reader would expect (`{"from", "to", "label", "explain"}`). They draw as red dashed lines on the Gaps layer.


## flows

A flow is data or requests moving through several items in order, drawn as animated particles.

```json
{"id": "checkout", "label": "Checkout", "color": "#ED93B1", "status": "planned",
 "paths": [["users", "web_p", "api_p", "egress", "payapi"]],
 "quote": "The source's own words for this flow", "source": "Design doc, section 5", "confidence": "recorded"}
```

`path` (one list) works as well as `paths`. Each consecutive pair should usually have a link; the flow panel lists the recorded links along the way and says when there are none. `description` adds a paragraph to the flow's panel, for example to say which steps are inferred. A flow whose `status` has a `toggle` hides with that layer, like nodes and links.


## boundaries

Security or trust boundaries. Give `members`; the layout draws a box around them, one box per floor and zone. A group listed as a member brings all of its contents with it, both for the box and for the "leaves / enters" lines in link panels.

Member boxes are merged only where the merged box takes in no non-members, so a boundary whose members are spread out draws as several tight boxes rather than one box over everything between them. Keeping members next to each other in the model gives fewer, cleaner boxes. The validator warns in the rare case a single member's box still contains a non-member; add it as a member or supply `boxes`. The `id` is shown on the toolbar button unless you set `short`, so keep ids short or set `short` (for example `"short": "B3 Data"`).

```json
{"id": "B3", "label": "Secrets and data", "members": ["kv_p", "db_p", "mi_p"],
 "description": "optional", "records": ["what the source says"], "open": ["open questions"], "toggle": "Unknowns"}
```

`toggle` hides the boundary unless that layer is on, for boundaries that exist only as assumptions. Supply `boxes` (`[[cx, cy, cz, w, h, d], ...]`) only to override the computed boxes. Link and flow panels list the boundaries a connection leaves and enters, based on `members`.


## issues

Findings measured against a standard or intended design.

```json
{"id": "i1", "title": "Prod API uses the non-prod identity", "category": "Environment mix-up",
 "members": ["api_p", "mi_np", "mi_p"],
 "links": [["api_p", "mi_np"]],
 "needs": [{"from": "api_p", "to": "mi_p", "label": "Should use mi-orders-prod"}],
 "records": ["what the source records"], "cause": "likely cause, labelled as inference",
 "fix": ["what needs to change"]}
```

- `links` marks existing links as problem links (drawn red).
- `needs` draws links the design needs but the source lacks (purple dashed).
- Items that should exist but do not are nodes with a `missing`-style status; add them to `members`.
- Members get a red "!" badge. Selecting an issue focuses the camera on its members.


## views and steps

**Views** are camera presets. Built in: `overview`, `top`, one per floor (`floor:<id>`) and one per zone (`zone:<id>`) when there is more than one. Add your own:

```json
{"id": "vendor-edge", "label": "Vendor edge", "focus": ["egress", "payapi"], "theta": -60, "phi": 60}
```

`focus` frames those items; or give `target: [x, y, z]` and `r`. `theta` turns around the scene in degrees (0 looks from the front), `phi` tilts from straight down (1) to level (90) and below (over 90).

**Steps** make a guided walkthrough:

```json
{"title": "2. Checkout", "text": "What to notice", "focus": ["web_p", "api_p"],
 "flows": ["checkout"], "boundaries": ["B4"], "view": "vendor-edge"}
```

A step dims everything outside `focus` and the step's flow paths, shows only its `flows` (none if it lists none; `"flows": ["all"]` shows every flow), and turns on its `boundaries`. Without `view`, the camera frames the focus. A first step with `view: "overview"` and `"flows": ["all"]` makes a good introduction.


## How layout works, and overrides

- Zones are laid left to right in list order; each zone is as wide as its widest floor.
- Inside a zone and floor, top-level groups and ungrouped nodes are packed into rows: groups first, in list order, then nodes, in list order. Set `order` (a number, lower first) on groups or nodes to interleave them; by default groups count as their list position and nodes as 10000 plus theirs. Put related items next to each other to keep them together.
- Groups are packed the same way inside, then grow to fit. Children of a `slab` stand on it, children of a `plate` sit on it, children of a `glass` group sit inside it.
- Floors are 18 units apart per level.
- `python3 scripts/layout.py model.json -o laid-out.json` (or `build.py --dump-layout`) writes the computed positions, which helps when tuning `pin`, `size` or order.


## Writing a good model

- **Every fact needs a source.** Set `source` and `confidence` on nodes, links and flows. A reviewer must be able to tell what the source records from what the team said or you inferred. The validator warns when nodes have neither.
- **Draw flows only where something states them.** Put the source's wording in `quote`. Links are structure; flows are claims about behaviour.
- **Model absence explicitly.** Use `gaps` for expected links that are missing, `missing`-status nodes for items that should exist, and `issues` to explain why.
- **Keep 3D labels short.** Put the full name in `label` and a short one in `short`; the validator warns above 34 characters.
- **Mind what you share.** The output inlines the whole model. Before sending it outside the team, remove secrets, internal hostnames, IP addresses and group or account ids that should not travel.
