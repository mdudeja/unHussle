#!/usr/bin/env bash
# Builds an Arch Linux package from the .deb that `tauri build` creates.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
version="$(bun -p "require('$root/src-tauri/tauri.conf.json').version")"
bundle_dir="$root/src-tauri/target/release/bundle"
deb="$bundle_dir/deb/unhussle_${version}_amd64.deb"
out_dir="$bundle_dir/arch"

if [[ ! -f $deb ]]; then
  echo "Missing $deb. Run 'bun run tauri build' first." >&2
  exit 1
fi

rm -rf "$out_dir"
mkdir -p "$out_dir"
cp "$root"/packaging/arch/* "$deb" "$out_dir/"
cd "$out_dir"
UNHUSSLE_VERSION="$version" makepkg --force --clean
