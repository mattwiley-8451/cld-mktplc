#!/bin/sh
# Add a skill to an existing plugin.
# Usage: scripts/new-skill.sh <plugin-name> <skill-name> [description]
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)

if [ $# -lt 2 ]; then
  echo "usage: $0 <plugin-name> <skill-name> [description]" >&2
  exit 2
fi

plugin=$1
skill=$2
description=${3:-"TODO: describe when Claude should use this skill"}
# Quote for YAML (double-quoted scalars share JSON escaping for \ and ").
yaml_description=$(printf '%s' "$description" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')

for n in "$plugin" "$skill"; do
  case $n in
    '' | *[!a-z0-9-]* | -* | *- | *--*)
      echo "error: '$n' must be kebab-case (lowercase letters, digits, single hyphens)" >&2
      exit 2
      ;;
  esac
done

plugin_dir=$root/plugins/$plugin
skill_dir=$plugin_dir/skills/$skill

[ -d "$plugin_dir" ] || { echo "error: plugin '$plugin' does not exist" >&2; exit 1; }
[ ! -e "$skill_dir" ] || { echo "error: skill '$skill' already exists in '$plugin'" >&2; exit 1; }

mkdir -p "$skill_dir"
cat > "$skill_dir/SKILL.md" <<SKILL
---
name: $skill
description: "$yaml_description"
---

TODO: instructions for Claude to follow when this skill is invoked.
SKILL

echo "created plugins/$plugin/skills/$skill/SKILL.md"
