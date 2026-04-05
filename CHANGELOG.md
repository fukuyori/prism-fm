# Changelog

All notable changes to Prism FM are documented in this file.

## [1.0.0-spumoni.3.6] - 2026-04-05

### Added

- **Properties dialog** -- Right-click context menu "Properties" shows file/folder details in a modal (Name, Type, MIME, Location, Size, Created, Modified, Accessed)
- **OS-specific properties** -- Windows: file attributes (Read-only, Hidden, System, Archive); macOS/Linux: owner, group, permissions (rwxr-xr-x)
- **Folder item count** -- Properties for folders shows number of direct children instead of recursive size calculation
- **Symlink target** -- Properties shows link target path for symbolic links
- **Click to copy** -- Name, Location, and Link Target values in Properties are clickable to copy to clipboard
- **Context menu scroll** -- Context menu supports scrolling when items exceed screen height

### Fixed

- **Windows hidden file detection** -- `dir /ah /b` now uses `shell: "cmd.exe"` to work correctly from Git Bash / non-cmd environments
- **closeSidebar not defined** -- Promoted from local `const` to global `var` so resize handler can access it
- **Context menu duplication** -- Added dedup flag between `mouseup` and `contextmenu` listeners to prevent double rendering
- **Properties layout shift** -- Fixed table column width with `table-layout: fixed` and `minWidth` preservation during "Copied!" feedback

## [1.0.0-spumoni.3.5] - 2026-04-05

### Added

- **Terminal settings** -- Customize modal (renamed from "Customize Colors") now includes a Terminal section at the top with preset selection and custom command/args input
- **Terminal presets** -- System Default, Windows Terminal, PowerShell (Windows), PowerShell 7 (pwsh), cmd, Terminal.app, iTerm2, kitty, Alacritty, GNOME Terminal, WezTerm, Custom
- **Terminal toolbar button** -- Terminal icon next to Split View button; opens terminal in active pane's directory
- **Terminal in context menu** -- "Open in Terminal" available for files (opens parent directory), folders (opens that folder), and background right-click (opens current directory)
- **Title bar double-click maximize** -- Tab bar drag-to-move and double-click-to-maximize implemented via mousedown tracking (works with `transparent: true`)
- **Window bounds persistence** -- Window size and maximized state saved to `window-bounds.json`; position determined by mouse cursor's monitor (centered on work area)

### Changed

- **Window frame** -- All platforms now use `titleBarStyle: "hidden"` instead of `frame: false` on Windows/Linux
- **Compact row heights** -- Detailed view icon 32→24px (svg 24→20px), col-icon 44→32px, padding 2→1px; List view icon 20→18px (svg 16→14px), col-icon 24px fixed, padding 0px
- **Customize modal** -- Renamed from "Customize Colors" to "Customize"
- **Settings menu** -- "Customize Colors..." renamed to "Customize..."
- **Split View** -- Moved from settings dialog to toolbar button; removed from view menu
- **Theme select styling** -- Dropdown uses `appearance: none` with custom arrow and themed `option` elements

## [1.0.0-spumoni.3.4] - 2026-04-05

### Added

- **Drive auto-refresh** -- Drive list polls every 5 seconds, reflecting USB insertion/removal without manual refresh
- **Eject drive** -- Context menu replaces "Unmount" with "Eject" (unmount + power-off) for safe device removal; uses `udisksctl power-off` with `eject` fallback

### Changed

- **File size right-aligned** -- Size column and header use `text-align: right` with thousands separator (e.g. `1,234 KB`)
- **Column padding** -- Added `padding-left: 12px` to size, date, and added columns for visual separation
- **Column resizers removed** -- Column widths are fixed at defaults (Size: 100px, Modified: 140px, Added: 140px); drag handles hidden
- **Responsive breakpoints reworked**:
  - 800px: File name truncates with ellipsis, all columns remain visible
  - 650px: Modified/Added columns hidden, toolbar wraps
  - 480px: Sidebar becomes overlay, all columns except icon/name hidden, compact UI
- **Row height reduced** -- Detailed view padding `4px` → `2px`, list view `2px` → `1px`
- **File name minimum width** -- `min-width: 8em` on `.file-name`, grid uses `minmax(8em, 1fr)` for name column

### Fixed

- **7za path on Linux** -- `path7za` now resolves to `app.asar.unpacked` instead of `app.asar`, fixing archive operations in packaged builds
- **Responsive column visibility** -- Removed JS-based column hiding (`updateResponsiveColumns`); CSS media queries handle all breakpoints consistently

## [1.0.0-spumoni.3.3] - 2026-04-05

### Added
- **Thumbnail view** -- Image thumbnails loaded via custom `thumb://` protocol with IntersectionObserver for lazy loading; thumbnail size adjustable via slider
- **List view** -- Compact single-line view with small icons, no size/date columns
- **Grid view CSS** -- Existing grid view now visually distinct from detailed view
- **Global default view mode** -- View mode selection applies to all folders (saved in localStorage as `defaultViewMode`); trash folder excluded (always detailed)

### Fixed
- **macOS transparency** -- Removed `vibrancy` in favor of `transparent: true` + `backgroundColor: "#00000000"` for consistent cross-platform transparency; CSS `backdrop-filter` handles blur on all platforms
- **macOS process exit** -- App now quits on all platforms when all windows are closed; added `before-quit` handler to ensure clean shutdown
- **macOS sandbox** -- `--no-sandbox` flag restricted to Linux only (was interfering with GPU compositing on macOS)
- **Thumbnail observer timing** -- `setupThumbnailObserver` moved from `finishNavigation` (before DOM render) to end of `renderFiles` (after DOM render); also called on virtual scroll chunk load

### Changed
- **Row height reduced** -- Detailed view padding `8px` to `4px 8px`, list view padding `2px 8px` with smaller icons (20px/16px) for higher density

## [1.0.0-spumoni.3.2] - 2026-04-04

### Added
- **Windows Recycle Bin browsing** -- Reads `$I` metadata files from `$Recycle.Bin` directly via Node.js binary parsing; displays original file name, size, modification date, and deletion date without PowerShell COM dependency
- **Deletion date column** -- Parses FILETIME from `$I` files; column header shows "Deleted" instead of "Added" when viewing trash; sort and column toggle menus also reflect "Date Deleted"
- **Multi-drive recycle bin** -- Scans `$Recycle.Bin` across all drive letters (A-Z)
- **Bundled 7za** -- Ships `7zip-bin` for all platforms (Windows/macOS/Linux, x64/arm64); no external 7-Zip installation required for archive operations (zip, 7z, tar, gz, bz2, xz, cab)
- **Japanese font support** -- Added Meiryo, Yu Gothic UI, Hiragino Sans, Noto Sans CJK JP to CSS font stack
- **Installer process termination** -- NSIS installer and uninstaller kill running `prism-fm.exe` via `taskkill` before proceeding

### Changed
- **Archive operations unified** -- Compress and extract use bundled `7za` on all platforms instead of platform-specific tools (PowerShell, zip, unzip)
- **Date sort behavior** -- Sorting by date (modified or added) no longer separates folders from files; items are sorted purely by timestamp
- **Empty recycle bin** -- Deletes `$I`/`$R` files directly via `fs.rm` instead of PowerShell `Clear-RecycleBin`
- **NSIS custom init** -- Removes old installation directory directly instead of renaming and running `old-uninstaller.exe` (avoids Windows Defender blocking unsigned executables)

### Fixed
- **Archive browsing guard** -- Non-archive files (e.g. `.jpg`) no longer trigger `7z l` when path resolution falls through to `handleArchiveBrowsing`
- **Recycle bin encoding** -- File names with CJK characters display correctly (previously garbled via PowerShell COM output)

### Performance
- **Recycle bin speed** -- Replaced PowerShell COM enumeration (~2s) with direct `$I` file parsing (~50ms); user SID cached after first retrieval

## [1.0.0-spumoni.3.1] - 2026-04-04

### Added
- **Custom window controls** -- Minimize/maximize/close buttons for Windows and Linux using `frame: false` (macOS uses native `titleBarStyle: "hidden"`)
- **Maximize button state** -- Icon switches between maximize (single square) and restore (overlapping squares) via `window-maximized` IPC event
- **Windows hidden file detection** -- Uses `dir /ah /b` for Windows `H` attribute and dot-prefix for correct hidden file recognition
- **Native drag to external apps** -- Files can be dragged from Prism FM to desktop or other applications using Electron's `webContents.startDrag` API
- **14 new file type icons** -- PDF, Spreadsheet, Presentation, Document, Text, Code, Markup, Data, Script, Database, Font, Archive, Disk Image, Executable, Library, Key/Certificate, 3D Model; all in consistent outline style
- **Build workflow** -- Separate `build:*:pack` and `build:*:installer` scripts for code signing workflow on all platforms
- **DevTools in production** -- F12 / Ctrl+Shift+I enabled in all builds for debugging

### Changed
- **Column visibility** -- Display settings (Size, Date Modified, Date Added) are now global instead of per-folder, ensuring consistency across split view panes
- **Default theme opacity** -- Background opacity increased from ~5% to ~65% across all built-in presets (Default Glass, Nord Frost, Amber Glow, Forest Mist, Light Frost)
- **External drop default** -- Drag from external apps defaults to move (Ctrl for copy) instead of always copying
- **NSIS uninstall** -- `deleteAppDataOnUninstall: true` removes `%APPDATA%\prism-fm` on uninstall

### Fixed
- **Column overflow** -- Hidden columns now use `display: none` to prevent content from appearing below file names
- **Drag crash** -- Removed `startDrag` call from inside `dragstart` event handler; native drag initiated separately to avoid Electron crash

### Performance
- **Hidden file detection** -- Replaced per-file `attrib` parsing with single `dir /ah /b` call per directory
- **Resize throttling** -- Window, sidebar, column, and preview panel resize handlers batched via `requestAnimationFrame`
- **IPC reduction** -- `parsePath` and `joinPaths` moved to renderer-local functions, eliminating 2 IPC round-trips per file during paste/drop
- **Async startup** -- `get-common-directories` converted from `fsSync` to async `fs.stat` with `Promise.all`
- **Dead code removal** -- Non-functional thumbnail observer stub removed

## [1.0.0-spumoni.3] - 2026-04-04

### Added
- **Window controls for Windows and Linux** -- Custom title bar buttons (minimize, maximize, close) for non-macOS platforms

## [1.0.0-spumoni.2] - 2026-04-04

### Fixed
- **Tab bar overlap** -- Fixed tab bar overlapping window controls on macOS

## [1.0.0-spumoni.1] - 2026-04-04

### Added
- **Application icon** -- Prism + rainbow spectrum icon (SVG source + multi-size PNG/ICO)
- **deb package build** -- `.deb` installer target alongside AppImage
- **Cross-platform build scripts** -- `build:win` (NSIS) and `build:mac` (DMG) npm scripts

### Fixed
- **Context menu** -- Fixed undefined variables (`opsPanelVisible`, `getUndoMenuLabel`) that prevented context menu from rendering
- **Context menu events** -- Moved file list context menu handlers to document-level listeners for reliable event capture

### Performance
- **Search input debounce** -- 150ms delay prevents full re-render on every keystroke
- **Scroll throttle** -- `requestAnimationFrame` reduces layout recalculation during scrolling
- **Virtual scrolling** -- Defined missing `ITEMS_PER_CHUNK` and implemented `setupScrollLoadObserver` for progressive loading of large directories (500+ items)
- **DOM optimization** -- Replaced `innerHTML = ""` with `textContent = ""` to skip the HTML parser
- **Selection UI diff** -- Only updates changed elements instead of looping all items
- **Async archive operations** -- Replaced `execSync` with async `exec` in extract/compress handlers to prevent UI freezes
