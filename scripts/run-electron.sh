#!/bin/sh
set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ELECTRON_BIN="${ELECTRON_BIN:-electron}"

# Some environments export this for CLI tooling, which makes Electron behave
# like plain Node.js and breaks the main process bootstrap.
unset ELECTRON_RUN_AS_NODE

EXTRA_ARGS=""
if [ -n "$WAYLAND_DISPLAY" ] || [ "$XDG_SESSION_TYPE" = "wayland" ]; then
  if [ -z "$ELECTRON_OZONE_PLATFORM_HINT" ]; then
    export ELECTRON_OZONE_PLATFORM_HINT=wayland
  fi
  EXTRA_ARGS="--ozone-platform=wayland --enable-features=UseOzonePlatform"
fi

exec "$ELECTRON_BIN" "$APP_DIR" $EXTRA_ARGS "$@"
