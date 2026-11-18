#!/bin/bash
# Regenerate this Codetopo profile pack for nrupala/vault-tracker.
# Usage: refresh.sh [git-ref]   (default: main)
# Requires: codetopo >= 0.9.1 on PATH (~/.cargo/bin/codetopo) and the
# house GitHub lane helpers (gh_tarball.py) for private-repo fetch.
set -euo pipefail
REF="${1:-main}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
export PYTHONPATH=/opt/muse/skills/custom-connector-setup/bin
python3 ~/workspace/custom-connectors/custom.legacy-github/bin/gh_tarball.py \
  nrupala vault-tracker "$REF" "$WORK/repo.tgz"
mkdir -p "$WORK/repo" && tar -xzf "$WORK/repo.tgz" -C "$WORK/repo" --strip-components=1
codetopo index --db "$WORK/graph.db" "$WORK/repo"
codetopo stats --db "$WORK/graph.db" --json > "$HERE/stats.json"
codetopo verify --db "$WORK/graph.db" > "$HERE/verify.txt" 2>&1 || true
codetopo snapshot --db "$WORK/graph.db" --out "$HERE/snapshot.json"
echo "Profile pack regenerated for ref $REF -> $HERE"
echo "Now update the header block of PROFILE.md (commit, counts, chain head) to match stats.json/verify.txt."
