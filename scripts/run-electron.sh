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

# Linux: when unprivileged user namespaces are restricted (Ubuntu 24.04+
# AppArmor default) Chromium falls back to the SUID helper chrome-sandbox,
# which is not setuid root in a plain npm install and aborts with
# "SUID sandbox helper binary ... is not configured correctly". Pushing
# --no-sandbox from main.js is too late (the check runs before JS), so add
# it here unless the helper is actually setuid root.
if [ "$(uname -s)" = "Linux" ]; then
  SANDBOX_HELPER="$(dirname "$(command -v "$ELECTRON_BIN" 2>/dev/null || echo "$ELECTRON_BIN")")/chrome-sandbox"
  [ -f "$APP_DIR/node_modules/electron/dist/chrome-sandbox" ] && SANDBOX_HELPER="$APP_DIR/node_modules/electron/dist/chrome-sandbox"
  if [ ! -u "$SANDBOX_HELPER" ] || [ "$(stat -c %U "$SANDBOX_HELPER" 2>/dev/null)" != "root" ]; then
    EXTRA_ARGS="$EXTRA_ARGS --no-sandbox"
  fi
fi

# Prefer the project-local electron when the global one is missing.
if ! command -v "$ELECTRON_BIN" >/dev/null 2>&1 && [ -x "$APP_DIR/node_modules/.bin/electron" ]; then
  ELECTRON_BIN="$APP_DIR/node_modules/.bin/electron"
fi

exec "$ELECTRON_BIN" "$APP_DIR" $EXTRA_ARGS "$@"
