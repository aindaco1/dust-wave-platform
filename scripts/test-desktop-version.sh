#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in
    2.9.5|2.9.6|2.10.0) version="$1" ;;
    *) echo "usage: test-desktop-version.sh 2.9.5|2.9.6|2.10.0" >&2; exit 64 ;;
esac
root="$(cd "$(dirname "$0")/.." && pwd)"
temporary_root="$(mktemp -d "${TMPDIR:-/tmp}/dustwave-desktop-test.XXXXXX")"
trap 'rm -rf "$temporary_root"' EXIT
rsync -a --exclude .build --exclude .swiftpm --exclude Package.resolved \
    "$root/desktop/" "$temporary_root/desktop/"
python3 - "$temporary_root/desktop/Package.swift" "$version" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
source = p.read_text()
constraint = '"2.9.5"..."2.10.0"'
if source.count(constraint) != 1:
    raise SystemExit('Desktop dependency contract changed; review the matrix')
p.write_text(source.replace(constraint, 'exact: "' + sys.argv[2] + '"'))
PY
swift test --package-path "$temporary_root/desktop"
python3 - "$temporary_root/desktop/Package.resolved" "$version" <<'PY'
import json, sys
pins = json.load(open(sys.argv[1]))['pins']
assert next(p for p in pins if p['identity'] == 'sparkle')['state']['version'] == sys.argv[2]
PY
