#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
    0.15.5|0.15.6|0.15.7) version="$1" ;;
    *) echo "usage: test-native-version.sh 0.15.5|0.15.6|0.15.7" >&2; exit 64 ;;
esac
root="$(cd "$(dirname "$0")/.." && pwd)"
temporary_root="$(mktemp -d "${TMPDIR:-/tmp}/dustwave-native-test.XXXXXX")"
trap 'rm -rf "$temporary_root"' EXIT

# Resolve each consumer version in a fresh package: older FluidAudio versions
# have no traits and must not inherit 0.15.7's resolved default traits.
rsync -a --exclude .build --exclude .swiftpm --exclude Package.resolved \
    "$root/native/" "$temporary_root/native/"
python3 - "$temporary_root/native/Package.swift" "$version" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
source = p.read_text()
constraint = '"0.15.5"..."0.15.7"'
if source.count(constraint) != 1:
    raise SystemExit('Native dependency contract changed; review the test matrix')
p.write_text(source.replace(constraint, 'exact: "' + sys.argv[2] + '"'))
PY
swift test --package-path "$temporary_root/native"
python3 - "$temporary_root/native/Package.resolved" "$version" <<'PY'
import json, sys
pins = json.load(open(sys.argv[1]))['pins']
assert next(p for p in pins if p['identity'] == 'fluidaudio')['state']['version'] == sys.argv[2]
PY
