#!/bin/sh
# Tests for scripts/new-plugin.sh and scripts/new-skill.sh.
# Runs against a temporary copy of the repo so the working tree is untouched.
set -u

here=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/repo"
cp -R "$here/.claude-plugin" "$here/plugins" "$here/scripts" "$tmp/repo/"
cd "$tmp/repo" || exit 1

fails=0
check() {
  # check <description> <command...>
  desc=$1; shift
  if "$@" >/dev/null 2>&1; then echo "ok   - $desc"; else echo "FAIL - $desc"; fails=$((fails + 1)); fi
}
check_not() {
  desc=$1; shift
  if "$@" >/dev/null 2>&1; then echo "FAIL - $desc"; fails=$((fails + 1)); else echo "ok   - $desc"; fi
}

check "new-plugin creates a plugin" sh scripts/new-plugin.sh demo-tool 'Demo "quoted" tool'
check "manifest exists" test -f plugins/demo-tool/.claude-plugin/plugin.json
check "manifest has name" grep -q '"name": "demo-tool"' plugins/demo-tool/.claude-plugin/plugin.json
check "starter skill exists" test -f plugins/demo-tool/skills/demo-tool/SKILL.md
check "marketplace lists new plugin" grep -q '"source": "./plugins/demo-tool"' .claude-plugin/marketplace.json
check "marketplace keeps existing plugin" grep -q '"name": "hello-plugin"' .claude-plugin/marketplace.json
check_not "new-plugin rejects duplicates" sh scripts/new-plugin.sh demo-tool
check_not "new-plugin rejects bad names" sh scripts/new-plugin.sh Bad_Name
check_not "new-plugin requires a name" sh scripts/new-plugin.sh

check "new-skill adds a skill" sh scripts/new-skill.sh demo-tool extra 'Extra skill'
check "added skill exists" test -f plugins/demo-tool/skills/extra/SKILL.md
check_not "new-skill rejects duplicates" sh scripts/new-skill.sh demo-tool extra
check_not "new-skill rejects unknown plugin" sh scripts/new-skill.sh nope extra

if command -v claude >/dev/null 2>&1; then
  check "marketplace validates" claude plugin validate .
fi

[ "$fails" -eq 0 ] && echo "all passed" || { echo "$fails failed"; exit 1; }
