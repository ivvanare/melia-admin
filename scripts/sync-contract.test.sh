#!/usr/bin/env bash
# Behavioural test for scripts/sync-contract.sh: it copies the API contract into contract/,
# records the upstream commit in contract/UPSTREAM, refuses a checkout that is not at the
# commit it was given, and leaves the snapshot untouched whenever it refuses.
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="$here/sync-contract.sh"

failures=0
passes=0
tmp_root="$(mktemp -d)"
trap 'rm -rf "$tmp_root"' EXIT

pass() { passes=$((passes + 1)); printf 'ok   %s\n' "$1"; }
fail() { failures=$((failures + 1)); printf 'FAIL %s\n     %s\n' "$1" "$2"; }

checksums() { (cd "$1" && sha256sum contract/* 2>/dev/null | sort); }

# Geometry matters: the script defaults to the sibling checkout, so the repository's sibling
# has to be the API checkout for the default path to be the one under test.
setup() {
  local name="$1"
  local base="$tmp_root/$name"
  mkdir -p "$base/melia/api" "$base/panel"
  printf 'openapi: 3.0.0\ninfo:\n  title: t\n' >"$base/melia/api/openapi.yaml"
  printf '# API rules\n\n- parse error.code\n' >"$base/melia/api/API.md"
  for repo in melia panel; do
    git -C "$base/$repo" init -q
    git -C "$base/$repo" config user.email t@t.t
    git -C "$base/$repo" config user.name t
  done
  git -C "$base/melia" add -A
  git -C "$base/melia" commit -qm contract
  printf 'seed\n' >"$base/panel/README.md"
  git -C "$base/panel" add -A
  git -C "$base/panel" commit -qm init
  printf '%s\n' "$base"
}

# --- writes the snapshot and the upstream it came from ---------------------------------------
base="$(setup default-source)"
sha="$(git -C "$base/melia" rev-parse HEAD)"
out="$(cd "$base/panel" && bash "$script" "$sha" 2>&1)"; rc=$?
upstream="$(cat "$base/panel/contract/UPSTREAM" 2>/dev/null)"
if [ "$rc" -ne 0 ]; then
  fail "writes the snapshot" "exit $rc: $out"
elif ! diff -q "$base/melia/api/openapi.yaml" "$base/panel/contract/openapi.yaml" >/dev/null; then
  fail "writes the snapshot" "contract/openapi.yaml does not match the source"
elif ! diff -q "$base/melia/api/API.md" "$base/panel/contract/API.md" >/dev/null; then
  fail "writes the snapshot" "contract/API.md does not match the source"
elif ! printf '%s\n' "$upstream" | grep -qx "commit: $sha"; then
  fail "writes the snapshot" "UPSTREAM does not carry the source commit: $upstream"
elif ! printf '%s\n' "$upstream" | grep -qE '^synced: [0-9]{4}-[0-9]{2}-[0-9]{2}$'; then
  fail "writes the snapshot" "UPSTREAM has no synced date: $upstream"
elif ! printf '%s\n' "$upstream" | grep -q '^source: '; then
  fail "writes the snapshot" "UPSTREAM does not name the source repository: $upstream"
else
  pass "writes the snapshot"
fi

# --- refuses a checkout that is not at the requested commit ----------------------------------
base="$(setup wrong-commit)"
sha="$(git -C "$base/melia" rev-parse HEAD)"
printf 'openapi: 3.0.0\ninfo:\n  title: newer\n' >"$base/melia/api/openapi.yaml"
git -C "$base/melia" commit -qam newer
before="$(checksums "$base/panel")"
out="$(cd "$base/panel" && bash "$script" "$sha" 2>&1)"; rc=$?
after="$(checksums "$base/panel")"
if [ "$rc" -eq 0 ]; then
  fail "refuses a checkout that is not at the requested commit" "expected failure, got exit 0: $out"
elif [ "$before" != "$after" ]; then
  fail "refuses a checkout that is not at the requested commit" "wrote a snapshot anyway: $after"
else
  pass "refuses a checkout that is not at the requested commit"
fi

# --- honours MELIA_SRC -----------------------------------------------------------------------
base="$(setup explicit-source)"
other="$base/elsewhere"
mkdir -p "$other/api"
printf 'openapi: 3.0.0\ninfo:\n  title: elsewhere\n' >"$other/api/openapi.yaml"
printf '# elsewhere\n' >"$other/api/API.md"
git -C "$other" init -q
git -C "$other" config user.email t@t.t
git -C "$other" config user.name t
git -C "$other" add -A
git -C "$other" commit -qm elsewhere
sha="$(git -C "$other" rev-parse HEAD)"
out="$(cd "$base/panel" && MELIA_SRC="$other" bash "$script" "$sha" 2>&1)"; rc=$?
if [ "$rc" -ne 0 ]; then
  fail "honours MELIA_SRC" "exit $rc: $out"
elif ! grep -q elsewhere "$base/panel/contract/openapi.yaml" 2>/dev/null; then
  fail "honours MELIA_SRC" "copied something other than MELIA_SRC's contract"
else
  pass "honours MELIA_SRC"
fi

# --- refuses a source that is not there ------------------------------------------------------
base="$(setup missing-source)"
sha="$(git -C "$base/melia" rev-parse HEAD)"
before="$(checksums "$base/panel")"
out="$(cd "$base/panel" && MELIA_SRC="$base/nope" bash "$script" "$sha" 2>&1)"; rc=$?
after="$(checksums "$base/panel")"
if [ "$rc" -eq 0 ]; then
  fail "refuses a source that is not there" "expected failure, got exit 0: $out"
elif [ "$before" != "$after" ]; then
  fail "refuses a source that is not there" "wrote a snapshot anyway: $after"
else
  pass "refuses a source that is not there"
fi

# --- refuses a source without the contract files ----------------------------------------------
base="$(setup unbuilt-contract)"
rm -rf "$base/melia/api"
printf 'nothing here\n' >"$base/melia/README.md"
git -C "$base/melia" add -A
git -C "$base/melia" commit -qm 'drop the contract'
sha="$(git -C "$base/melia" rev-parse HEAD)"
before="$(checksums "$base/panel")"
out="$(cd "$base/panel" && bash "$script" "$sha" 2>&1)"; rc=$?
after="$(checksums "$base/panel")"
if [ "$rc" -eq 0 ]; then
  fail "refuses a source without the contract files" "expected failure, got exit 0: $out"
elif [ "$before" != "$after" ]; then
  fail "refuses a source without the contract files" "wrote a snapshot anyway: $after"
else
  pass "refuses a source without the contract files"
fi

# --- requires the commit argument -------------------------------------------------------------
base="$(setup no-argument)"
out="$(cd "$base/panel" && bash "$script" 2>&1)"; rc=$?
if [ "$rc" -ne 2 ]; then
  fail "requires the commit argument" "expected exit 2, got $rc: $out"
elif ! printf '%s' "$out" | grep -q 'usage:'; then
  fail "requires the commit argument" "no usage line: $out"
else
  pass "requires the commit argument"
fi

printf '\n%s passed, %s failed\n' "$passes" "$failures"
[ "$failures" -eq 0 ]
