#!/usr/bin/env bash
# Copy the API contract into contract/ and record the upstream commit it came from.
#
#   scripts/sync-contract.sh <commit>
#   MELIA_SRC=/somewhere/ecosystem_complete scripts/sync-contract.sh <commit>
#
# The API owns its contract, and the contract lives in the API's own repository
# (github.com/ivvanare/ecosystem_complete, the `melia` checkout). This repository consumes it as
# a **versioned snapshot**, never as a submodule: the copy plus contract/UPSTREAM is what makes
# the version the SPA actually speaks visible in a diff, and the `contract` CI job fails when the
# snapshot stops matching the commit that UPSTREAM declares.
#
# This script is the only manual step. Run it with the API commit you mean to consume, review the
# resulting diff of contract/, and commit both together: the copy without the UPSTREAM, or the
# other way round, is exactly the silent drift the snapshot exists to prevent.
#
# The source defaults to the sibling of the MAIN clone, so a worktree reuses the checkout that
# already exists instead of needing its own. It must be checked out at <commit>: copying from
# whatever HEAD happens to be is how a contract nobody declared ends up here.
set -euo pipefail

usage() { printf 'usage: %s <commit>\n' "${BASH_SOURCE[0]##*/}" >&2; }
[ "$#" -ge 1 ] && [ -n "$1" ] || { usage; exit 2; }

die() { printf 'sync-contract: %s\n' "$1" >&2; exit 1; }

common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
main_root="$(dirname "$common_dir")"
src="${MELIA_SRC:-$main_root/../melia}"
[ -d "$src" ] || die "$src is not a checkout of the API repository (set MELIA_SRC)."
src="$(cd "$src" && pwd -P)"
git -C "$src" rev-parse --git-dir >/dev/null 2>&1 || die "$src is not a git checkout."

requested="$(git -C "$src" rev-parse --verify --quiet "$1^{commit}")" \
  || die "$src has no commit $1."
head="$(git -C "$src" rev-parse HEAD)"
[ "$head" = "$requested" ] \
  || die "$src is at $head, not at $requested — check it out first, then run this again."

for f in api/openapi.yaml api/API.md; do
  [ -f "$src/$f" ] || die "$src has no $f at $requested."
  git -C "$src" diff --quiet "$requested" -- "$f" \
    || die "$src/$f has uncommitted changes; commit or discard them first."
done

root="$(git rev-parse --show-toplevel)"
dest="$root/contract"
mkdir -p "$dest"
cp "$src/api/openapi.yaml" "$dest/openapi.yaml"
cp "$src/api/API.md" "$dest/API.md"
{
  printf 'source: ivvanare/ecosystem_complete\n'
  printf 'commit: %s\n' "$requested"
  printf 'synced: %s\n' "$(date -u +%Y-%m-%d)"
} >"$dest/UPSTREAM"

printf 'sync-contract: %s from %s\n' "${requested:0:12}" "$src"
printf 'sync-contract: review the contract/ diff and commit it with this run\n'
