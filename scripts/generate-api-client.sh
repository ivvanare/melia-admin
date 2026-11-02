#!/usr/bin/env bash
# Regenerate src/app/core/generated/api-types.ts from the contract snapshot.
#
#   scripts/generate-api-client.sh
#
# The generated file is committed: it is the wire shape this SPA speaks, and the `contract` CI job
# regenerates it and fails when the result differs, so a snapshot change that was not regenerated
# cannot land. The generator version is the exact version declared in package.json — never a caret
# and never `latest` — because a change in the generator's output would otherwise move the diff
# without the contract having changed at all.
#
# The hand-written types in AdminApi stay the source of truth for the logic; the generated ones
# describe the wire. Keep them separate: mixing both in one type loses track of which one rules.
set -euo pipefail

die() { printf 'generate-api-client: %s\n' "$1" >&2; exit 1; }

root="$(git rev-parse --show-toplevel)"
spec="$root/contract/openapi.yaml"
out="$root/src/app/core/generated/api-types.ts"

[ -f "$spec" ] || die "no contract/openapi.yaml — run scripts/sync-contract.sh first."

version="$(sed -n 's/.*"openapi-typescript": *"\([^"]*\)".*/\1/p' "$root/package.json" | head -1)"
[ -n "$version" ] || die "package.json declares no openapi-typescript devDependency."
case "$version" in
  [0-9]*) ;;
  *) die "package.json declares openapi-typescript \"$version\"; pin the exact version instead." ;;
esac

mkdir -p "$(dirname "$out")"
cli="$root/node_modules/openapi-typescript/bin/cli.js"
if [ -f "$cli" ]; then
  node "$cli" "$spec" -o "$out"
else
  # The CI contract job needs the generated file without a workspace install, so the declared
  # version runs through npx there. Same version, same output.
  printf 'generate-api-client: openapi-typescript is not installed; running %s through npx\n' "$version" >&2
  npx --yes "openapi-typescript@$version" "$spec" -o "$out"
fi

printf 'generate-api-client: wrote %s\n' "${out#"$root"/}"
