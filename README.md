# Prism FM

A lightweight, transparent file manager for Linux, Windows, and macOS utilizing Electron.

> **Fork of [compiledkernel-idk/prism-fm](https://github.com/compiledkernel-idk/prism-fm)** (original by tomiwaf)

![Preview](file-manager.png)

## Changelog

### v1.0.0-spumoni.3.1

#### Windows support

- **Window controls** -- Custom minimize/maximize/close buttons using `frame: false` (macOS uses native `titleBarStyle: "hidden"`)
- **Maximize button state** -- Icon switches between maximize (square) and restore (overlapping squares) on state change
- **Hidden file detection** -- Uses Windows `H` attribute via `dir /ah /b` and dot-prefix for correct hidden file recognition
- **Build workflow** -- Separate pack and installer steps for code signing workflow

#### Bug fixes

- **Split view column visibility** -- Column display settings (Size, Date Modified, Date Added) are now global instead of per-folder, ensuring consistent display across split view panes
- **Column element overflow** -- Hidden columns now use `display: none` to prevent content from overflowing below file names
- **External drop default action** -- Drag from external apps defaults to move (Ctrl for copy) instead of always copying

#### Drag and drop

- **Native drag to external apps** -- Files can be dragged from Prism FM to the desktop or other applications using Electron's `startDrag` API
- **Internal drag via native path** -- Internal and external drops are distinguished by an `isDragging` flag for correct move/copy behavior
- **Drag cleanup** -- Drag state is cleaned up via `drag-ended` IPC after native drag completes

#### New file type icons (20 categories)

PDF, Spreadsheet, Presentation, Document, Text, Code (`</>`), Markup (`<>`), Data (bar chart), Script (terminal), Database (cylinder), Font (Aa), Archive (lock box), Disk Image (disc), Executable (play), Library (book), Key/Certificate (key), 3D Model (layers) -- all in consistent outline style with existing icons

#### Theme adjustments

- **Default opacity** -- Background opacity increased from ~5% to ~65% across all built-in theme presets (Default Glass, Nord Frost, Amber Glow, Forest Mist, Light Frost) for better readability
- **CSS and JS defaults synchronized** -- `:root` variables and `THEME_VARIABLE_DEFAULTS` kept in sync

#### Performance improvements

- **Hidden file detection** -- Replaced `attrib` per-file parsing with single `dir /ah /b` call per directory
- **Resize throttling** -- Window, sidebar, column, and preview panel resize handlers batched via `requestAnimationFrame`
- **IPC reduction** -- `parsePath` and `joinPaths` moved to renderer-local functions, eliminating 2 IPC round-trips per file during paste/drop
- **Async startup** -- `get-common-directories` handler converted from `fsSync` to async `fs.stat` with `Promise.all`
- **Dead code removal** -- Non-functional thumbnail observer stub removed

#### Installer

- **NSIS cleanup** -- `deleteAppDataOnUninstall: true` added to remove `%APPDATA%\prism-fm` on uninstall
- **DevTools access** -- F12 / Ctrl+Shift+I enabled in production builds for debugging

### v1.0.0-spumoni.3

- **Window controls for Windows and Linux** -- Custom title bar buttons (minimize, maximize, close) for non-macOS platforms

### v1.0.0-spumoni.2

- **Tab bar fix** -- Fixed tab bar overlapping window controls on macOS

### v1.0.0-spumoni.1

- **Context menu fix** -- Fixed undefined variables and moved handlers to document-level listeners
- **Performance** -- Search debounce, scroll throttle, virtual scrolling, DOM optimization, selection diff update, async archive operations
- **New features** -- Application icon, deb package build, cross-platform build scripts

## Features

- **Transparent UI**: Designed for seamless integration with modern compositors (Hyprland, Sway, etc.) and desktop environments.
- **Dual Pane Navigation**: Efficient file management with side-by-side views.
- **Core Operations**: Copy, move, delete, rename, and archive management.
- **Drag and Drop**: Native drag to external apps, external drop with move/copy support.
- **Preview System**: Integrated image and text previews.
- **Tagging**: Essential file organization with color-coded tags.
- **Theme Customizer**: Built-in theme editor with presets (Default Glass, Nord Frost, Amber Glow, Forest Mist, Light Frost) and Wal theme import.
- **XDG Integration**: Functions as a system-wide directory picker (Linux).

## Installation

```bash
git clone https://github.com/fukuyori/prism-fm.git
cd prism-fm
npm install
```

### Build

**One-step build (pack + installer):**

```bash
npm run build          # Current platform (auto-detect)
npm run build:win      # Windows (NSIS installer)
npm run build:mac      # macOS (DMG)
npm run build:linux    # Linux (AppImage + deb)
```

**Two-step build (for code signing):**

```bash
# Step 1: Pack executable only
npm run build:win:pack      # -> dist/win-unpacked/prism-fm.exe
npm run build:mac:pack      # -> dist/mac/prism-fm.app (or dist/mac-arm64/)
npm run build:linux:pack    # -> dist/linux-unpacked/prism-fm

# Step 2: Sign the binary (platform-specific)
# Windows:  signtool sign /f cert.pfx dist/win-unpacked/prism-fm.exe
# macOS:    codesign --deep --force --sign "Developer ID" dist/mac/prism-fm.app

# Step 3: Create installer from signed binary
npm run build:win:installer      # -> dist/prism-fm-<version>-x64.exe
npm run build:mac:installer      # -> dist/prism-fm-<version>.dmg
npm run build:linux:installer    # -> dist/prism-fm-<version>.AppImage + .deb
```

### Dependencies

**Arch Linux:**

```bash
sudo pacman -S nodejs npm electron
```

**Debian / Ubuntu:**

```bash
sudo apt install nodejs npm
sudo npm install -g electron
```

**Fedora:**

```bash
sudo dnf install nodejs npm
sudo npm install -g electron
```

## Usage

Launch via terminal or application menu:

```bash
prism-fm [path]
```

### Key Bindings

| Key | Action |
| :--- | :--- |
| `Ctrl+C` / `Ctrl+V` | Copy / Paste |
| `Ctrl+X` | Cut |
| `F2` | Rename |
| `Del` / `Shift+Del` | Trash / Permanent Delete |
| `Ctrl+T` / `Ctrl+W` | New Tab / Close Tab |
| `Ctrl+L` | Focus Path |
| `Ctrl+H` | Toggle Hidden Files |
| `F12` / `Ctrl+Shift+I` | Developer Tools |

## Configuration

Configuration is stored in `~/.config/prism-fm/` (Linux/macOS) or `%APPDATA%\prism-fm\` (Windows).

**Compositor Configuration (Hyprland):**

```ini
layerrule = blur,class:prism-fm
windowrulev2 = opacity 0.9 0.8,class:^(prism-fm)$
```

## License

GPL-3.0 (Original code by tomiwaf licensed under MIT)
