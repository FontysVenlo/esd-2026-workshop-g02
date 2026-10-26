#!/bin/bash

workshop_dir="$(cd "$(dirname "$0")" && pwd -P)"

fail() {
  printf '\n%s\n' "$1"
  printf 'Press Return to close this window.'
  read -r unused
  exit 1
}

if [ ! -f "$workshop_dir/compose.yaml" ]; then
  fail 'The workshop files are not together. Run Stop Workshop.command from the extracted folder.'
fi

docker_bin="$(command -v docker 2>/dev/null || true)"
if [ -z "$docker_bin" ]; then
  for candidate in "$HOME/.docker/bin/docker" /usr/local/bin/docker /opt/homebrew/bin/docker /Applications/Docker.app/Contents/Resources/bin/docker; do
    if [ -x "$candidate" ]; then
      docker_bin="$candidate"
      break
    fi
  done
fi

if [ -z "$docker_bin" ]; then
  fail 'Docker was not found. Install Docker Desktop, then run this file again.'
fi

printf 'Stopping the Northstar Supply workshop...\n'
if ! "$docker_bin" compose -f "$workshop_dir/compose.yaml" --profile load down; then
  fail 'The workshop could not be stopped. Check Docker Desktop for container errors.'
fi

printf 'Workshop stopped. Browser notes remain saved in your browser.\n'
