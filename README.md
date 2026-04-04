# Prism FM

A lightweight, transparent file manager for Linux utilizing Electron.

> **Fork of [compiledkernel-idk/prism-fm](https://github.com/compiledkernel-idk/prism-fm)** (original by tomiwaf)

![Preview](file-manager.png)

## Changes from upstream (v1.0.0-spumoni.1)

### Bug fixes

- **Context menu not appearing on right-click** -- Fixed undefined variables (`opsPanelVisible`, `getUndoMenuLabel`) that caused runtime errors, preventing the context menu from rendering
- **Context menu event handling** -- Moved file list context menu handlers to document-level listeners for reliable event capture across platforms

### Performance improvements

- **Search input debounce** (150ms) -- Prevents full re-render on every keystroke
- **Scroll event throttle** (`requestAnimationFrame`) -- Reduces layout recalculation during scrolling
- **Virtual scrolling fix** -- Defined missing `ITEMS_PER_CHUNK` and implemented `setupScrollLoadObserver` for progressive loading of large directories (500+ items)
- **DOM optimization** -- Replaced `innerHTML = ""` with `textContent = ""` to skip the HTML parser
- **Selection UI diff update** -- Only updates changed elements instead of looping all items
- **Async archive operations** -- Replaced `execSync` with async `exec` in extract/compress handlers to prevent UI freezes

### New features

- **Application icon** -- New prism + rainbow spectrum icon (SVG source + multi-size PNG/ICO)
- **deb package build** -- Added `.deb` installer target alongside AppImage
- **Cross-platform build scripts** -- Added `build:win` and `build:mac` npm scripts for Windows (NSIS) and macOS (DMG) builds
- **Context menu styling** -- Reduced menu item padding for a more compact appearance

## Features

- **Transparent UI**: Designed for seamless integration with modern compositors (Hyprland, Sway, etc.).
- **Dual Pane Navigation**: Efficient file management with side-by-side views.
- **Core Operations**: Copy, move, delete, rename, and archive management.
- **Preview System**: Integrated image and text previews.
- **Tagging**: Essential file organization with color-coded tags.
- **XDG Integration**: Functions as a system-wide directory picker.

## Installation

```bash
git clone https://github.com/fukuyori/prism-fm.git
cd prism-fm
npm install
```

### Build

```bash
npm run build          # Linux (AppImage + deb)
npm run build:win      # Windows (NSIS installer)
npm run build:mac      # macOS (DMG)
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
| `F2` | Rename |
| `Del` / `Shift+Del` | Trash / Permanent Delete |
| `Ctrl+T` / `Ctrl+W` | New Tab / Close Tab |
| `Ctrl+L` | Focus Path |
| `Ctrl+H` | Toggle Hidden Files |

## Configuration

Configuration is stored in `~/.config/prism-fm/`.

**Compositor Configuration (Hyprland):**

```ini
layerrule = blur,class:prism-fm
windowrulev2 = opacity 0.9 0.8,class:^(prism-fm)$
```

## License

GPL-3.0 (Original code by tomiwaf licensed under MIT)
