# Prism FM

A lightweight, transparent file manager for Linux, Windows, and macOS utilizing Electron.

> **Fork of [compiledkernel-idk/prism-fm](https://github.com/compiledkernel-idk/prism-fm)** (original by tomiwaf)

![Preview](file-manager.png)

## Recent Changes

See [CHANGELOG.md](CHANGELOG.md) for the full history.

### v1.0.0-spumoni.3.4

- File size column right-aligned with thousands separator
- Responsive layout reworked: 800px file name truncation, 650px hide dates, 480px sidebar overlay
- Column resizers removed (fixed widths)
- Drive list auto-refresh (5s polling), Eject replaces Unmount in context menu
- Compact row heights for Detailed/List views
- 7za path fix for packaged Linux builds

### v1.0.0-spumoni.3.3

- macOS transparency fix, process exit fix
- Four view modes: Detailed, List, Grid, Thumbnail (with image preview)
- Global default view mode setting, compact row heights

### v1.0.0-spumoni.3.2

- Windows Recycle Bin browsing via native `$I` file parsing (no PowerShell)
- Bundled 7za for cross-platform archive operations
- Japanese font support, date sort improvements, installer process termination

### v1.0.0-spumoni.3.1

- Windows window controls, hidden file detection, native drag-and-drop
- 14 new file type icons, theme opacity adjustments, performance optimizations
- Separate pack/installer build scripts for code signing

### v1.0.0-spumoni.3

- Custom window controls for Windows and Linux

### v1.0.0-spumoni.2

- Tab bar overlap fix for macOS

### v1.0.0-spumoni.1

- Context menu fix, performance improvements, application icon, cross-platform builds

## Features

- **Transparent UI**: Designed for seamless integration with modern compositors (Hyprland, Sway, etc.) and desktop environments.
- **Dual Pane Navigation**: Efficient file management with side-by-side views.
- **Core Operations**: Copy, move, delete, rename, and archive management (extract/compress only; browsing inside archives is not supported).
- **Drag and Drop**: Drag files out to external apps (native drag). Drop files from external apps to copy into the current directory. Within Prism FM, drag to move (hold Ctrl to copy). Drag and drop into/from archives is not supported.
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

This fork is licensed under [GPL-3.0](LICENSE).

The original Prism FM by tomiwaf is licensed under MIT. This fork includes the bundled [7za binary](https://www.7-zip.org/) (LGPL-2.1) for archive operations.

See [LICENSES-THIRD-PARTY.md](LICENSES-THIRD-PARTY.md) for full third-party license details.
