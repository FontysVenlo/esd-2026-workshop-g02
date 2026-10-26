#!/bin/bash

workshop_dir="$(cd "$(dirname "$0")" && pwd -P)"

fail() {
  printf '\n%s\n' "$1"
  printf 'Press Return to close this window.'
  read -r unused
  exit 1
}

if [ ! -f "$workshop_dir/compose.yaml" ]; then
  fail 'The workshop files are not together. Extract the ZIP, open the extracted folder, and run Start Workshop.command there.'
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
  fail 'Docker was not found. Install and start Docker Desktop, then run this file again.'
fi

if ! "$docker_bin" info >/dev/null 2>&1; then
  fail 'Docker Desktop is not ready. Start it, wait for the engine, then run this file again.'
fi

printf 'Starting the Northstar Supply workshop...\n'
printf 'The first start downloads container images and may take several minutes.\n'
if ! "$docker_bin" compose -f "$workshop_dir/compose.yaml" --profile load up --build -d --wait; then
  fail 'The workshop could not start. Check Docker Desktop for container errors, then try again.'
fi

printf '\nWorkshop ready: http://localhost:8088\n'
open 'http://localhost:8088'
