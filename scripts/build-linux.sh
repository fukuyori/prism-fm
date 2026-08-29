#!/bin/sh
# Build Prism FM for Linux and produce a .deb (optionally an AppImage too).
#
#   scripts/build-linux.sh              # deb only  -> dist/prism-fm-<version>-amd64.deb
#   scripts/build-linux.sh --appimage   # deb + AppImage
#   scripts/build-linux.sh --clean      # remove dist/ first
#   scripts/build-linux.sh --smoke      # launch the unpacked build for a few seconds afterwards
#   scripts/build-linux.sh --install    # sudo apt install the resulting .deb
#
# Steps: check toolchain -> install deps if missing -> ensure the Electron
# binary is present -> electron-builder --linux -> verify the .deb with
# dpkg-deb -> print the artifact.
set -eu

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

WANT_APPIMAGE=0
CLEAN=0
SMOKE=0
INSTALL=0
for arg in "$@"; do
  case "$arg" in
    --appimage) WANT_APPIMAGE=1 ;;
    --clean) CLEAN=1 ;;
    --smoke) SMOKE=1 ;;
    --install) INSTALL=1 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

# --- 1. toolchain --------------------------------------------------------
command -v node >/dev/null 2>&1 || die "node not found"
command -v npm >/dev/null 2>&1 || die "npm not found"
command -v dpkg-deb >/dev/null 2>&1 || die "dpkg-deb not found (apt install dpkg)"
# electron-builder uses fakeroot for deb packaging
command -v fakeroot >/dev/null 2>&1 || die "fakeroot not found (apt install fakeroot)"

VERSION="$(node -p "require('./package.json').version")"
ARCH="$(dpkg --print-architecture 2>/dev/null || echo amd64)"
case "$(uname -m)" in
  x86_64) BUILDER_ARCH=x64 ;;
  aarch64) BUILDER_ARCH=arm64 ;;
  *) BUILDER_ARCH="$(uname -m)" ;;
esac
log "Prism FM $VERSION ($ARCH / electron-builder $BUILDER_ARCH), node $(node -v), npm $(npm -v)"

# --- 2. dependencies -----------------------------------------------------
if [ ! -d node_modules ] || [ ! -x node_modules/.bin/electron-builder ]; then
  log "Installing dependencies (npm ci)"
  npm ci
fi

# The Electron binary is fetched by electron's postinstall; a
# --ignore-scripts install or an interrupted download leaves it missing.
if [ ! -x node_modules/electron/dist/electron ]; then
  log "Downloading Electron binary"
  (cd node_modules/electron && node install.js)
fi
ELECTRON_VERSION="$(node -p "require('./node_modules/electron/package.json').version")"
log "Electron $ELECTRON_VERSION"

# Unset in case the CLI environment exports it; it makes Electron behave
# like plain Node and breaks electron-builder's version probing.
unset ELECTRON_RUN_AS_NODE

# --- 3. clean ------------------------------------------------------------
if [ "$CLEAN" = 1 ] && [ -d dist ]; then
  log "Removing dist/"
  rm -rf dist
fi

# --- 4. build ------------------------------------------------------------
TARGETS="deb"
[ "$WANT_APPIMAGE" = 1 ] && TARGETS="deb AppImage"
log "Building: $TARGETS"
# shellcheck disable=SC2086
npx electron-builder --linux $TARGETS --"$BUILDER_ARCH"

# --- 5. verify -----------------------------------------------------------
DEB="dist/prism-fm-${VERSION}-${ARCH}.deb"
[ -f "$DEB" ] || DEB="$(ls -t dist/prism-fm-*.deb 2>/dev/null | head -1 || true)"
[ -n "$DEB" ] && [ -f "$DEB" ] || die "no .deb produced in dist/"

log "Verifying $DEB"
dpkg-deb --info "$DEB" | sed -n '/Package:/p;/Version:/p;/Architecture:/p;/Depends:/p' | sed 's/^ */    /'
dpkg-deb --contents "$DEB" | grep -q ' ./opt/prism-fm/prism-fm$' || die "executable /opt/prism-fm/prism-fm missing from package"
dpkg-deb --contents "$DEB" | grep -q 'prism-fm.desktop' || die ".desktop entry missing from package"
DEB_SIZE="$(du -h "$DEB" | cut -f1)"

# --- 6. smoke test (optional) -------------------------------------------
if [ "$SMOKE" = 1 ]; then
  UNPACKED="dist/linux-unpacked/prism-fm"
  [ -x "$UNPACKED" ] || die "unpacked build not found: $UNPACKED"
  log "Smoke test: launching $UNPACKED for 6s"
  set +e
  timeout 6 "$UNPACKED" --no-sandbox --enable-logging >dist/smoke.log 2>&1
  rc=$?
  set -e
  if grep -qiE 'SIGSEGV|SIGTRAP|FATAL|Uncaught|ReferenceError' dist/smoke.log; then
    grep -iE 'SIGSEGV|SIGTRAP|FATAL|Uncaught|ReferenceError' dist/smoke.log | head -5
    die "smoke test found errors (see dist/smoke.log)"
  fi
  # 124 = still running when timeout fired, which is the success case
  [ "$rc" = 124 ] || die "app exited early with code $rc (see dist/smoke.log)"
  log "Smoke test OK"
fi

# --- 7. done -------------------------------------------------------------
log "Done"
printf '    %s (%s)\n' "$DEB" "$DEB_SIZE"
if [ "$WANT_APPIMAGE" = 1 ]; then
  APPIMAGE="$(ls -t dist/prism-fm-*.AppImage 2>/dev/null | head -1 || true)"
  [ -n "$APPIMAGE" ] && printf '    %s (%s)\n' "$APPIMAGE" "$(du -h "$APPIMAGE" | cut -f1)"
fi

if [ "$INSTALL" = 1 ]; then
  log "Installing $DEB"
  sudo apt install -y "./$DEB"
else
  printf '\nInstall with:\n    sudo apt install ./%s\n' "$DEB"
fi
