#!/usr/bin/env bash
# Sourceable before a usable Node exists. Consumers supply floors and search order.
dustwave_node_meets_floor() {
  local version major minor patch floor floor_major floor_minor floor_patch
  version="$("$1" --version 2>/dev/null)" || return 1
  shift
  [[ "$version" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] || return 1
  major="${BASH_REMATCH[1]}"; minor="${BASH_REMATCH[2]}"; patch="${BASH_REMATCH[3]}"
  for floor in "$@"; do
    [[ "$floor" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] || return 2
    floor_major="${BASH_REMATCH[1]}"; floor_minor="${BASH_REMATCH[2]}"; floor_patch="${BASH_REMATCH[3]}"
    if (( major == floor_major && (minor > floor_minor || (minor == floor_minor && patch >= floor_patch)) )); then return 0; fi
  done
  return 1
}

dustwave_prefer_node_path() {
  local predicate="$1" candidate
  shift
  if command -v node >/dev/null 2>&1 && "$predicate" "$(command -v node)"; then return 0; fi
  for candidate in "$@"; do
    if [[ -x "$candidate/node" ]] && "$predicate" "$candidate/node"; then
      export PATH="$candidate:$PATH"
      return 0
    fi
  done
  return 1
}
