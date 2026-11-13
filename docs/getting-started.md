# Getting started: creating plugins

This repo is a Claude Code plugin marketplace. Each plugin lives in `plugins/<name>/` and is listed in `.claude-plugin/marketplace.json`.

## Layout

```
.claude-plugin/marketplace.json        # marketplace manifest; lists every plugin
plugins/<name>/
  .claude-plugin/plugin.json           # plugin manifest (name, description, version, author)
  skills/<skill>/SKILL.md              # one directory per skill
scripts/new-plugin.sh                  # scaffold a plugin and register it
scripts/new-skill.sh                   # add a skill to an existing plugin
tests/test-scripts.sh                  # tests for the scripts
```

## Create a plugin

```sh
scripts/new-plugin.sh <plugin-name> ["description"]
```

This creates `plugins/<plugin-name>/` with a manifest (author taken from `git config user.name`) and a starter skill named after the plugin. It also appends the plugin to `.claude-plugin/marketplace.json`.

Names must be kebab-case: lowercase letters, digits, and single hyphens. The script refuses to overwrite an existing plugin.

## Add a skill to a plugin

```sh
scripts/new-skill.sh <plugin-name> <skill-name> ["description"]
```

Then edit the generated `SKILL.md`:

- `description` in the frontmatter is what Claude uses to decide when to invoke the skill, so say when to use it.
- The body is the instructions Claude follows when the skill runs.

## Validate and test

```sh
claude plugin validate .      # checks marketplace and plugin manifests
sh tests/test-scripts.sh      # checks the scaffolding scripts
```

## Try it locally

From a Claude Code session:

```
/plugin marketplace add /path/to/cld-mktplc
/plugin install <plugin-name>@cld-mktplc
```

After editing a plugin, reinstall it or restart the session to pick up changes.

## Publish

Commit and push to `main`. Users install with:

```
/plugin marketplace add mattwiley-8451/cld-mktplc
/plugin install <plugin-name>@cld-mktplc
```

Bump `version` in the plugin's `plugin.json` when you change a plugin so installed copies update.

## Notes

- The scripts are POSIX `sh` and need only `awk`, `sed`, and `mktemp`; they do not need `jq`.
- `new-plugin.sh` edits `marketplace.json` assuming the layout it ships with (the `plugins` array closes with a line of two spaces and `]`). If you reformat that file, register plugins by hand.
