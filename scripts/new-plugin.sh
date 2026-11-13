#!/bin/sh
# Scaffold a new plugin, register it in the marketplace, and give it a starter skill.
# Usage: scripts/new-plugin.sh <plugin-name> [description]
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
marketplace=$root/.claude-plugin/marketplace.json

if [ $# -lt 1 ]; then
  echo "usage: $0 <plugin-name> [description]" >&2
  exit 2
fi

name=$1
description=${2:-"TODO: describe $name"}
author=$(git config user.name 2>/dev/null || true)
author=${author:-"Your Name"}

case $name in
  '' | *[!a-z0-9-]* | -* | *- | *--*)
    echo "error: '$name' must be kebab-case (lowercase letters, digits, single hyphens)" >&2
    exit 2
    ;;
esac

plugin_dir=$root/plugins/$name
[ ! -e "$plugin_dir" ] || { echo "error: plugin '$name' already exists" >&2; exit 1; }
[ -f "$marketplace" ] || { echo "error: $marketplace not found" >&2; exit 1; }

# Escape backslashes and double quotes for embedding in JSON strings.
json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}
d=$(json_escape "$description")
a=$(json_escape "$author")

mkdir -p "$plugin_dir/.claude-plugin"
cat > "$plugin_dir/.claude-plugin/plugin.json" <<JSON
{
  "name": "$name",
  "description": "$d",
  "version": "0.1.0",
  "author": {
    "name": "$a"
  }
}
JSON

# Append an entry to the marketplace "plugins" array (closing bracket is the
# line consisting of two spaces and "]").
tmp=$(mktemp)
NAME=$name DESC=$d awk '
  function entry() {
    print "    {"
    print "      \"name\": \"" ENVIRON["NAME"] "\","
    print "      \"source\": \"./plugins/" ENVIRON["NAME"] "\","
    print "      \"description\": \"" ENVIRON["DESC"] "\""
    print "    }"
  }
  $0 == "  ]" && have_prev {
    print prev ","
    entry()
    have_prev = 0
  }
  have_prev { print prev }
  { prev = $0; have_prev = 1 }
  END { if (have_prev) print prev }
' "$marketplace" > "$tmp"
cat "$tmp" > "$marketplace"
rm -f "$tmp"

echo "created plugins/$name and registered it in .claude-plugin/marketplace.json"
sh "$root/scripts/new-skill.sh" "$name" "$name" "$description"
