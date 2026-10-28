#!/usr/bin/env python3
"""Refresh the reviewable GeoNames US postal reference (Python standard library only)."""
import argparse
import datetime
import hashlib
import io
import json
import pathlib
import urllib.request
import zipfile

SOURCE = 'https://download.geonames.org/export/zip/US.zip'


def build_reference(text):
    states, postals = {}, {}
    for line in text.splitlines():
        fields = line.split('\t')
        if len(fields) < 5:
            continue
        country, postal, city, state_name, state = fields[:5]
        if country != 'US' or len(postal) != 5 or not postal.isdigit() or not state:
            continue
        states[state] = state_name
        entry = postals.setdefault(postal, {})
        entry.setdefault(state, set()).add(city)
    if len(postals) < 40000:
        raise ValueError('Incomplete postal reference; keeping the existing snapshot')
    return states, {postal: {state: sorted(cities) for state, cities in sorted(entries.items())}
                    for postal, entries in sorted(postals.items())}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    with urllib.request.urlopen(SOURCE, timeout=60) as response:
        archive = response.read()
    with zipfile.ZipFile(io.BytesIO(archive)) as source:
        states, postals = build_reference(source.read('US.txt').decode('utf-8'))
    snapshot = {
        'source': SOURCE, 'attribution': 'GeoNames',
        'license': 'https://creativecommons.org/licenses/by/4.0/',
        'retrievedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'sha256': hashlib.sha256(archive).hexdigest(), 'states': states, 'postals': postals
    }
    target = pathlib.Path(args.output)
    target.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'Updated {len(postals)} US postal codes. Review the snapshot diff before release.')
