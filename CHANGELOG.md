# Changelog

All notable changes to Prism FM are documented in this file.

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
