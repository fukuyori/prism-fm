

// Ensure Electron runs as an app, not as Node.js
delete process.env.ELECTRON_RUN_AS_NODE;

// Wayland support - must be set before require("electron")
if (process.env.WAYLAND_DISPLAY || process.env.XDG_SESSION_TYPE === 'wayland') {
  if (!process.env.ELECTRON_OZONE_PLATFORM_HINT) {
    process.env.ELECTRON_OZONE_PLATFORM_HINT = 'wayland';
  }
}

// Disable sandbox for packaged builds (AppImage cannot set SUID on chrome-sandbox)
if (process.platform === 'linux' && !process.argv.includes('--no-sandbox')) {
  process.argv.push('--no-sandbox');
}

const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  Menu,
  clipboard,
  globalShortcut,
  protocol,
  screen,
  net,
} = require("electron");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const sizeOf = require("image-size");
const { fileURLToPath } = require("url");
const { path7za: path7zaRaw } = require("7zip-bin");
const path7za = path7zaRaw.replace("app.asar", "app.asar.unpacked");

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-accelerated-video-decode');

let isPicker = false;
let isDev = false;

app.name = "prism-fm";

let mainWindow;
const cancelOperations = new Set();
let activeOperationCount = 0;

function logCommandFailure(command, error) {
  if (!command) return;
  const message = error?.message || String(error || "");
  const stderr = error?.stderr || "";
  const stdout = error?.stdout || "";
  const detail = [message, stderr, stdout].filter(Boolean).join("\n");
  console.error(`[command failed] ${command}\n${detail}`);
}


function toFileUrl(p) {
  const withSlashes = p.replace(/\\/g, "/");

  return (
    "file://" +
    encodeURI(withSlashes.startsWith("/") ? withSlashes : "/" + withSlashes)
  );
}

function getUserArgs() {
  const appPath = app.getAppPath();
  const exePath = app.getPath("exe");
  return process.argv.filter((arg, idx) => {
    if (idx === 0) return false;
    if (arg === appPath || arg === exePath) return false;
    return true;
  });
}

async function collectWalThemes() {
  const walDir = path.join(app.getPath("home"), ".config", "wal", "colorschemes");
  try {
    const stat = await fs.stat(walDir);
    if (!stat.isDirectory()) return [];
  } catch {
    return [];
  }

  const results = [];
  const walk = async (dir, depth) => {
    if (depth > 4) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;

      try {
        const raw = await fs.readFile(fullPath, "utf8");
        const data = JSON.parse(raw);
        if (!data || !data.colors || !data.special) continue;
        const rel = path
          .relative(walDir, fullPath)
          .replace(/\\/g, "/")
          .replace(/\.json$/i, "");
        const name = rel.split("/").join(" / ");
        results.push({
          name,
          path: fullPath,
          colors: data.colors,
          special: data.special,
          alpha: data.alpha,
          wallpaper: data.wallpaper,
        });
      } catch { }
    }
  };

  await walk(walDir, 0);
  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

function resolveStartPath(args) {
  let startPath = null;

  for (let i = args.length - 1; i >= 0; i--) {
    const arg = args[i];
    if (!arg.startsWith("-")) {
      startPath = arg;
      break;
    }
  }

  if (!startPath) {
    const npmArgv = process.env.npm_config_argv;
    if (npmArgv) {
      try {
        const parsed = JSON.parse(npmArgv);
        const candidates = [];
        if (Array.isArray(parsed.remain)) candidates.push(...parsed.remain);
        if (Array.isArray(parsed.original)) {
          candidates.push(
            ...parsed.original.filter((val) => val !== "run" && val !== "start"),
          );
        }
        for (let i = candidates.length - 1; i >= 0; i--) {
          const arg = String(candidates[i] || "");
          if (arg && !arg.startsWith("-")) {
            startPath = arg;
            break;
          }
        }
      } catch { }
    }
  }

  if (!startPath) return null;
  if (startPath.startsWith("file://")) {
    try {
      startPath = fileURLToPath(startPath);
    } catch {
      return null;
    }
  }
  if (!path.isAbsolute(startPath)) {
    return path.resolve(process.cwd(), startPath);
  }
  return startPath;
}

function getPickerOptions(args) {
  let pickerMode = "open";
  if (args.includes("--mode=save")) pickerMode = "save";
  if (args.includes("--mode=directory")) pickerMode = "directory";

  const allowMultiple = args.includes("--multiple");
  const filenameArg = args.find((arg) => arg.startsWith("--filename="));
  const defaultFilename = filenameArg ? filenameArg.substring(11) : "";

  return { pickerMode, allowMultiple, defaultFilename };
}

function buildWindowQuery(startPath, pickerOptions) {
  const query = {
    picker: isPicker ? "true" : "false",
    pickerMode: pickerOptions.pickerMode,
    allowMultiple: pickerOptions.allowMultiple ? "true" : "false",
    defaultFilename: pickerOptions.defaultFilename,
  };
  if (startPath) query.startPath = startPath;
  return query;
}

function registerDevtoolsShortcuts() {
  const register = (accelerator) => {
    const registered = globalShortcut.register(accelerator, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.toggleDevTools();
      }
    });
    if (!registered) {
      console.warn(`Failed to register devtools shortcut: ${accelerator}`);
    }
  };

  try {
    register("F12");
    register("CommandOrControl+Shift+I");
  } catch (error) {
    console.warn("Failed to register devtools shortcuts:", error);
  }
}


function loadWindowBounds() {
  try {
    const file = path.join(app.getPath("userData"), "window-bounds.json");
    return JSON.parse(fsSync.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function saveWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const isMax = mainWindow.isMaximized();
  const prev = loadWindowBounds();
  const bounds = isMax
    ? { width: prev?.width || 1200, height: prev?.height || 800, maximized: true }
    : { width: mainWindow.getBounds().width, height: mainWindow.getBounds().height, maximized: false };
  try {
    const file = path.join(app.getPath("userData"), "window-bounds.json");
    fsSync.writeFileSync(file, JSON.stringify(bounds));
  } catch { }
}

function createWindow() {
  const saved = loadWindowBounds();
  const winWidth = saved?.width || 1200;
  const winHeight = saved?.height || 800;

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const area = display.workArea;
  const x = Math.round(area.x + (area.width - winWidth) / 2);
  const y = Math.round(area.y + (area.height - winHeight) / 2);

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x,
    y,
    minWidth: 360,
    minHeight: 300,
    transparent: true,
    backgroundColor: "#00000000",
    titleBarStyle: "hidden",
    ...(process.platform === "darwin"
      ? { trafficLightPosition: { x: 10, y: 10 } }
      : {}),
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (saved?.maximized) {
    mainWindow.maximize();
  }

  const userArgs = getUserArgs();
  isPicker = userArgs.includes("--picker");
  const pickerOptions = getPickerOptions(userArgs);
  let startPath = resolveStartPath(userArgs);
  const appPath = app.getAppPath();
  const exePath = app.getPath("exe");
  if (
    startPath &&
    (startPath === appPath ||
      startPath === exePath ||
      path.resolve(startPath) === path.resolve(appPath))
  ) {
    startPath = null;
  }
  const query = buildWindowQuery(startPath, pickerOptions);

  mainWindow.loadFile("index.html", { query });

  mainWindow.webContents.on("did-finish-load", () => {
    if (isPicker) {
      const titles = {
        open: "Open File",
        save: "Save File",
        directory: "Select Folder",
      };
      mainWindow.setTitle(titles[pickerOptions.pickerMode] || "File Picker");
    } else {
      mainWindow.setTitle("Prism FM");
    }
  });

  Menu.setApplicationMenu(null);

  mainWindow.webContents.on("before-input-event", (event, input) => {
    const isF12 = input.type === "keyDown" && input.key === "F12";
    const isCtrlShiftI =
      input.type === "keyDown" &&
      input.key.toLowerCase() === "i" &&
      (input.control || input.meta) &&
      input.shift;

    if (isF12 || isCtrlShiftI) {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.toggleDevTools();
      }
    }
  });

  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("window-maximized", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("window-maximized", false);
  });

  mainWindow.on("resize", saveWindowBounds);
  mainWindow.on("move", saveWindowBounds);
  mainWindow.on("maximize", saveWindowBounds);
  mainWindow.on("unmaximize", saveWindowBounds);

  let forceQuit = false;
  mainWindow.on("close", (e) => {
    if (forceQuit) return;
    if (cancelOperations.size > 0 || activeOperationCount > 0) {
      e.preventDefault();
      dialog
        .showMessageBox(mainWindow, {
          type: "warning",
          buttons: ["Cancel", "Quit Anyway"],
          defaultId: 0,
          cancelId: 0,
          title: "Operation in Progress",
          message: "A file operation is still running. Quitting now may result in incomplete files.",
        })
        .then(({ response }) => {
          if (response === 1) {
            forceQuit = true;
            mainWindow.close();
          }
        });
      return;
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

protocol.registerSchemesAsPrivileged([
  { scheme: "thumb", privileges: { bypassCSP: true, supportFetchAPI: true } },
]);

const os = require("os");
const { promisify } = require("util");
const crypto = require("crypto");

const thumbCache = new Map();
const THUMB_MAX_CACHE = 500;

const VIDEO_EXTENSIONS = new Set([
  ".mp4", ".mkv", ".webm", ".mov", ".avi", ".wmv", ".flv", ".m4v", ".ts", ".vob", ".ogv", ".3gp",
]);

const PDF_EXTENSIONS = new Set([".pdf"]);

function isVideoFile(filePath) {
  return VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isPdfFile(filePath) {
  return PDF_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function generateThumbnail(filePath) {
  const cached = thumbCache.get(filePath);
  if (cached) {
    try { await fs.access(cached); return cached; } catch { thumbCache.delete(filePath); }
  }

  const hash = crypto.createHash("sha256").update(filePath).digest("hex");
  const thumbDir = path.join(os.tmpdir(), "prism-thumbs");
  await fs.mkdir(thumbDir, { recursive: true });
  const outPath = path.join(thumbDir, `${hash}.png`);

  try {
    await fs.access(outPath);
    thumbCache.set(filePath, outPath);
    return outPath;
  } catch { }

  const execFileAsync = promisify(require("child_process").execFile);
  const isPdf = isPdfFile(filePath);
  const isVideo = isVideoFile(filePath);

  try {
    if (process.platform === "darwin") {
      // qlmanage handles PDF, video, and many other formats
      const qlTmpDir = path.join(thumbDir, `ql-${hash}`);
      await fs.mkdir(qlTmpDir, { recursive: true });
      await execFileAsync("qlmanage", ["-t", "-s", "256", "-o", qlTmpDir, filePath], { timeout: 15000 });
      const qlExpected = path.join(qlTmpDir, path.basename(filePath) + ".png");
      try {
        await fs.access(qlExpected);
        await fs.rename(qlExpected, outPath);
      } catch {
        return null;
      } finally {
        fs.rm(qlTmpDir, { recursive: true, force: true }).catch(() => {});
      }
    } else if (process.platform === "linux") {
      if (isPdf) {
        const baseName = outPath.replace(/\.png$/, "");
        await execFileAsync("pdftoppm", ["-png", "-f", "1", "-l", "1", "-scale-to", "256", filePath, baseName], { timeout: 10000 });
        const generatedPath = baseName + "-1.png";
        try {
          await fs.access(generatedPath);
          await fs.rename(generatedPath, outPath);
        } catch {
          return null;
        }
      } else if (isVideo) {
        // Try ffmpegthumbnailer first, fallback to ffmpeg
        try {
          await execFileAsync("ffmpegthumbnailer", ["-i", filePath, "-o", outPath, "-s", "256", "-t", "10%"], { timeout: 15000 });
        } catch {
          try {
            await execFileAsync("ffmpeg", ["-i", filePath, "-ss", "00:00:01", "-vframes", "1", "-vf", "scale=256:-1", "-y", outPath], { timeout: 15000 });
          } catch {
            return null;
          }
        }
        try {
          await fs.access(outPath);
        } catch {
          return null;
        }
      } else {
        return null;
      }
    } else {
      return null;
    }
  } catch {
    return null;
  }

  if (thumbCache.size >= THUMB_MAX_CACHE) {
    const firstKey = thumbCache.keys().next().value;
    thumbCache.delete(firstKey);
  }
  thumbCache.set(filePath, outPath);
  return outPath;
}

app.whenReady().then(() => {
  protocol.handle("thumb", async (request) => {
    const filePath = decodeURIComponent(request.url.replace(/^thumb:\/\//, ""));

    if (isPdfFile(filePath) || isVideoFile(filePath)) {
      const thumbPath = await generateThumbnail(filePath);
      if (thumbPath) {
        return net.fetch("file://" + encodeURI(thumbPath).replace(/#/g, "%23"));
      }
      return new Response("", { status: 404 });
    }

    return net.fetch("file://" + encodeURI(filePath).replace(/#/g, "%23"));
  });

  isDev = process.env.PRISM_DEVTOOLS === "1";
  createWindow();

  if (isDev) {
    registerDevtoolsShortcuts();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  if (mainWindow) {
    mainWindow.removeAllListeners("close");
    mainWindow.close();
  }
});

app.on("will-quit", () => {
  try {
    globalShortcut.unregisterAll();
  } catch (error) {
    console.warn("Failed to unregister global shortcuts:", error);
  }
});


ipcMain.on("window-start-drag", () => {
  if (mainWindow && !mainWindow.isMaximized()) {
    mainWindow.setMovable(true);
  }
});

ipcMain.on("window-move-by", (event, dx, dy) => {
  if (!mainWindow || mainWindow.isMaximized()) return;
  const [x, y] = mainWindow.getPosition();
  mainWindow.setPosition(x + dx, y + dy);
});

ipcMain.on("window-minimize", () => {
  mainWindow?.minimize();
});

ipcMain.on("window-maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on("window-close", () => {
  mainWindow?.close();
});

ipcMain.on("picker-confirm", (event, paths) => {
  if (Array.isArray(paths)) {
    paths.forEach((p) => process.stdout.write(p + "\n"));
  }
  app.exit(0);
});

ipcMain.on("picker-cancel", () => {
  app.exit(1);
});


const { execFile } = require("child_process");

function getWindowsHiddenSet(dirPath) {
  const { exec } = require("child_process");
  return new Promise((resolve) => {
    exec(`dir /ah /b "${dirPath}"`,
      { encoding: "utf8", windowsHide: true, timeout: 5000, maxBuffer: 4 * 1024 * 1024, shell: "cmd.exe" },
      (err, stdout) => {
        const hidden = new Set();
        if (err || !stdout) { resolve(hidden); return; }
        for (const name of stdout.split("\r\n")) {
          if (name) hidden.add(name);
        }
        resolve(hidden);
      },
    );
  });
}

let _cachedSid = null;
async function getWindowsUserSid() {
  if (_cachedSid) return _cachedSid;
  const { promisify } = require("util");
  const { stdout } = await promisify(execFile)(
    "powershell.exe",
    ["-NoProfile", "-Command", "([System.Security.Principal.WindowsIdentity]::GetCurrent()).User.Value"],
    { windowsHide: true },
  );
  _cachedSid = stdout.trim();
  return _cachedSid;
}

function parseRecycleBinMeta(buf) {
  if (buf.length < 28) return null;
  const version = buf.readInt32LE(0);
  if (version !== 2 && version !== 1) return null;
  const sizeLo = buf.readUInt32LE(8);
  const sizeHi = buf.readUInt32LE(12);
  const size = sizeHi * 0x100000000 + sizeLo;
  const timeLo = buf.readUInt32LE(16);
  const timeHi = buf.readUInt32LE(20);
  const fileTime = timeHi * 0x100000000 + timeLo;
  const deletedDate = new Date(fileTime / 10000 - 11644473600000);

  let originalPath = "";
  if (version === 2) {
    const pathLen = buf.readInt32LE(24);
    const pathBuf = buf.slice(28, 28 + pathLen * 2);
    originalPath = pathBuf.toString("utf16le").replace(/\0+$/, "");
  } else {
    const pathBuf = buf.slice(24);
    originalPath = pathBuf.toString("utf16le").replace(/\0+$/, "");
  }
  return { size, deletedDate, originalPath };
}

async function getWindowsRecycleBinContents() {
  try {
    const sid = await getWindowsUserSid();
    const drives = [];
    for (let c = 67; c <= 90; c++) {
      drives.push(String.fromCharCode(c));
    }
    drives.unshift("A", "B");

    const contents = [];

    for (const drive of drives) {
      const rbDir = `${drive}:\\$Recycle.Bin\\${sid}`;
      let entries;
      try {
        entries = await fs.readdir(rbDir);
      } catch {
        continue;
      }

      const iFiles = entries.filter((e) => e.startsWith("$I"));

      await Promise.all(iFiles.map(async (iFile) => {
        const iPath = path.join(rbDir, iFile);
        const rFile = "$R" + iFile.slice(2);
        const rPath = path.join(rbDir, rFile);

        try {
          const buf = await fs.readFile(iPath);
          const meta = parseRecycleBinMeta(buf);
          if (!meta || !meta.originalPath) return;

          const name = path.basename(meta.originalPath);
          let isDir = false;
          let modified = null;
          try {
            const stats = await fs.stat(rPath);
            isDir = stats.isDirectory();
            modified = stats.mtime;
          } catch { }

          contents.push({
            name,
            path: rPath,
            isDirectory: isDir,
            isFile: !isDir,
            isSymlink: false,
            hidden: false,
            size: isDir ? 0 : meta.size,
            modified,
            created: meta.deletedDate,
            extension: isDir ? null : path.extname(name).toLowerCase(),
            originalPath: meta.originalPath,
          });
        } catch { }
      }));
    }

    contents.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    return { success: true, contents, path: "shell:RecycleBinFolder" };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

ipcMain.handle("get-directory-contents", async (event, dirPath) => {
  if (dirPath === "shell:RecycleBinFolder") {
    return await getWindowsRecycleBinContents();
  }

  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    const isWin = process.platform === "win32";
    const winHiddenSet = isWin ? await getWindowsHiddenSet(dirPath) : null;

    const contents = await Promise.all(
      items.map(async (item) => {
        const fullPath = path.join(dirPath, item.name);
        let stats = null;
        let linkTarget = null;
        const hidden = isWin
          ? (winHiddenSet.has(item.name) || item.name.startsWith("."))
          : item.name.startsWith(".");

        try {
          stats = await fs.stat(fullPath);
          if (item.isSymbolicLink()) {
            linkTarget = await fs.readlink(fullPath);
          }
        } catch (err) { }

        return {
          name: item.name,
          path: fullPath,
          isDirectory: item.isDirectory(),
          isFile: item.isFile(),
          isSymlink: item.isSymbolicLink(),
          linkTarget,
          hidden,
          size: stats?.size || 0,
          modified: stats?.mtime || null,
          created: stats?.birthtime || null,
          extension: item.isFile()
            ? path.extname(item.name).toLowerCase()
            : null,
        };
      }),
    );

    contents.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    return { success: true, contents, path: dirPath };
  } catch (error) {
    if (error.code === "ENOTDIR" || error.code === "ENOENT") {
      return await handleArchiveBrowsing(dirPath);
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-home-directory", () => {
  return app.getPath("home");
});

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

ipcMain.handle("get-wal-themes", async () => {
  try {
    return await collectWalThemes();
  } catch {
    return [];
  }
});

ipcMain.handle("get-common-directories", async () => {
  const homePath = app.getPath("home");

  const existingOrNull = async (p) => {
    if (!p) return null;
    try {
      const stat = await fs.stat(p);
      return stat.isDirectory() ? p : null;
    } catch { }
    return null;
  };

  const getElectronPathOrNull = async (name) => {
    try {
      return await existingOrNull(app.getPath(name));
    } catch {
      return null;
    }
  };

  const pickHomeSubdir = async (candidates) => {
    for (const name of candidates) {
      const p = await existingOrNull(path.join(homePath, name));
      if (p) return p;
    }
    return null;
  };

  const [desktop, documents, downloads, pictures, music, videos] =
    await Promise.all([
      getElectronPathOrNull("desktop")
        .then((r) => r ?? pickHomeSubdir(["Desktop", "desktop", "Schreibtisch", "Bureau"]))
        .then((r) => r ?? homePath),
      getElectronPathOrNull("documents")
        .then((r) => r ?? pickHomeSubdir(["Documents", "documents", "Dokumente", "Documenti"]))
        .then((r) => r ?? homePath),
      getElectronPathOrNull("downloads")
        .then((r) => r ?? pickHomeSubdir(["Downloads", "downloads", "Téléchargements", "Scaricati"]))
        .then((r) => r ?? homePath),
      getElectronPathOrNull("pictures")
        .then((r) => r ?? pickHomeSubdir(["Pictures", "pictures", "Images", "Bilder", "Immagini"]))
        .then((r) => r ?? homePath),
      getElectronPathOrNull("music")
        .then((r) => r ?? pickHomeSubdir(["Music", "music", "Musik", "Musica"]))
        .then((r) => r ?? homePath),
      getElectronPathOrNull("videos")
        .then((r) => r ?? pickHomeSubdir(["Videos", "videos", "Vidéo", "Video"]))
        .then((r) => r ?? homePath),
    ]);

  let trash = null;
  try {
    if (process.platform === "win32") {
      trash = "shell:RecycleBinFolder";
    } else if (process.platform === "darwin") {
      trash = await existingOrNull(path.join(homePath, ".Trash"));
    } else if (process.platform === "linux") {
      trash = await existingOrNull(path.join(homePath, ".local", "share", "Trash", "files"))
        ?? await existingOrNull(path.join(homePath, ".Trash"));
    }
  } catch { }

  return {
    root: "/",
    ...(trash ? { trash } : {}),
    home: homePath,
    desktop,
    documents,
    downloads,
    pictures,
    music,
    videos,
    config: path.join(homePath, ".config"),
  };
});

ipcMain.handle("path-exists", async (event, checkPath) => {
  try {
    await fs.access(checkPath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("get-parent-directory", (event, currentPath) => {
  return path.dirname(currentPath);
});

ipcMain.handle("join-paths", (event, ...paths) => {
  return path.join(...paths);
});

ipcMain.handle("parse-path", (event, pathString) => {
  return path.parse(pathString);
});


ipcMain.handle("open-file", async (event, filePath) => {
  try {
    const { spawn } = require("child_process");


    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", filePath], {
        detached: true,
        stdio: "ignore",
        shell: true
      }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [filePath], {
        detached: true,
        stdio: "ignore"
      }).unref();
    } else {

      spawn("xdg-open", [filePath], {
        detached: true,
        stdio: "ignore"
      }).unref();
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("show-in-folder", async (event, filePath) => {
  shell.showItemInFolder(filePath);
  return { success: true };
});

ipcMain.handle("open-terminal", async (event, dirPath) => {
  const { spawn } = require("child_process");
  try {
    if (process.platform === "win32") {
      spawn("cmd.exe", ["/c", "start", "cmd.exe"], {
        cwd: dirPath,
        shell: true,
      });
    } else if (process.platform === "darwin") {
      spawn("open", ["-a", "Terminal", dirPath]);
    } else {
      const child = spawn("kitty", [], {
        cwd: dirPath,
        detached: true,
        stdio: "ignore",
      });
      child.on("error", (e) => {
        if (e.code === "ENOENT") {
          const child2 = spawn("x-terminal-emulator", [], {
            cwd: dirPath,
            detached: true,
            stdio: "ignore",
          });
          child2.on("error", (e2) => {
            if (e2.code === "ENOENT") {
              spawn("gnome-terminal", [`--working-directory=${dirPath}`], {
                detached: true,
                stdio: "ignore",
              });
            }
          });
          child2.unref();
        }
      });
      child.unref();
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("open-terminal-custom", async (event, dirPath, command, args) => {
  const { spawn } = require("child_process");
  try {
    const parsedArgs = args
      .replace(/\{dir\}/g, dirPath)
      .match(/(?:[^\s"]+|"[^"]*")+/g)
      ?.map((a) => a.replace(/^"|"$/g, "")) || [];
    const child = spawn(command, parsedArgs, {
      cwd: dirPath,
      detached: true,
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    child.unref();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("batch-delete", async (event, itemPaths, operationId) => {
  activeOperationCount++;
  const cancelKey = operationId ? String(operationId) : null;
  const shouldCancel = () => Boolean(cancelKey && cancelOperations.has(cancelKey));

  let totalFiles = 0;
  let deletedFiles = 0;
  const errors = [];

  const countFiles = async (p) => {
    try {
      const stats = await fs.lstat(p);
      if (stats.isDirectory()) {
        const children = await fs.readdir(p);
        for (const c of children) await countFiles(path.join(p, c));
      } else {
        totalFiles++;
      }
    } catch { totalFiles++; }
  };

  for (const p of itemPaths) {
    await countFiles(p);
  }
  if (totalFiles === 0) totalFiles = 1;

  const reportProgress = () => {
    const percent = Math.min(100, (deletedFiles / totalFiles) * 100);
    event.sender.send("file-operation-progress", percent);
  };

  const deleteRecursive = async (p) => {
    if (shouldCancel()) {
      throw Object.assign(new Error("Operation cancelled"), { code: "CANCELLED" });
    }
    try {
      const stats = await fs.lstat(p);
      if (stats.isDirectory()) {
        const children = await fs.readdir(p);
        for (const child of children) {
          await deleteRecursive(path.join(p, child));
        }
        await fs.rmdir(p);
      } else {
        await fs.unlink(p);
        deletedFiles++;
        reportProgress();
      }
    } catch (err) {
      if (err?.code === "CANCELLED") throw err;
      // Fallback: try force rm
      try {
        await fs.rm(p, { recursive: true, force: true });
        deletedFiles++;
        reportProgress();
      } catch (rmErr) {
        errors.push({ path: p, error: rmErr.message });
      }
    }
  };

  try {
    for (const p of itemPaths) {
      await deleteRecursive(p);
    }

    return {
      success: errors.length === 0 || deletedFiles > 0,
      deleted: deletedFiles,
      errors,
    };
  } catch (error) {
    if (error?.code === "CANCELLED") {
      return { success: false, cancelled: true, error: "Cancelled" };
    }
    return { success: false, error: error.message };
  } finally {
    activeOperationCount = Math.max(0, activeOperationCount - 1);
    if (cancelKey) cancelOperations.delete(cancelKey);
  }
});

ipcMain.handle("delete-item", async (event, itemPath) => {
  try {
    const stats = await fs.stat(itemPath);

    if (stats.isDirectory()) {
      await fs.rm(itemPath, { recursive: true, force: true });
    } else {
      try {
        await fs.unlink(itemPath);
      } catch (err) {
        if (err && (err.code === "EACCES" || err.code === "EPERM")) {
          await fs.chmod(itemPath, 0o600);
          await fs.unlink(itemPath);
        } else {
          throw err;
        }
      }
    }

    return { success: true };
  } catch (error) {
    try {
      await fs.rm(itemPath, { recursive: true, force: true });
      return { success: true };
    } catch (finalErr) {
      return { success: false, error: finalErr.message, code: finalErr.code };
    }
  }
});

ipcMain.handle("delete-item-sudo", async (event, itemPath, password) => {
  const { exec } = require("child_process");

  const safePath = itemPath.replace(/"/g, '\\"');

  return new Promise((resolve) => {
    const child = exec(
      `sudo -S -k -p '' rm -rf "${safePath}"`,
      (error, stdout, stderr) => {
        if (error) {
          logCommandFailure(
            `sudo -S -k -p '' rm -rf "${safePath}"`,
            { message: error.message, stderr, stdout },
          );
        }
        resolve(
          error
            ? { success: false, error: stderr || error.message }
            : { success: true },
        );
      },
    );

    child.stdin.write(password + "\n");
    child.stdin.end();
  });
});

ipcMain.handle("empty-recycle-bin", async () => {
  if (process.platform !== "win32") {
    return { success: false, error: "Not supported on this platform" };
  }
  try {
    const sid = await getWindowsUserSid();
    for (let c = 65; c <= 90; c++) {
      const rbDir = `${String.fromCharCode(c)}:\\$Recycle.Bin\\${sid}`;
      let entries;
      try { entries = await fs.readdir(rbDir); } catch { continue; }
      await Promise.all(entries.filter((e) => e.startsWith("$I") || e.startsWith("$R")).map(async (e) => {
        try { await fs.rm(path.join(rbDir, e), { recursive: true, force: true }); } catch { }
      }));
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("trash-item", async (event, itemPath) => {
  try {
    await shell.trashItem(itemPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("restore-trash-items", async (event, originalPaths) => {
  const list = Array.isArray(originalPaths)
    ? originalPaths.filter(Boolean)
    : [];
  if (list.length === 0) {
    return { success: false, error: "No paths provided" };
  }

  if (process.platform !== "linux") {
    return { success: false, error: "Restore from Trash is not supported" };
  }

  const homePath = app.getPath("home");
  const trashBase = path.join(homePath, ".local", "share", "Trash");
  const trashFilesDir = path.join(trashBase, "files");
  const trashInfoDir = path.join(trashBase, "info");

  const normalizePath = (p) =>
    String(p || "")
      .replace(/\\/g, "/")
      .replace(/\/+$/, "");

  const decodePath = (value) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  let infoFiles = [];
  try {
    infoFiles = await fs.readdir(trashInfoDir);
  } catch (error) {
    return { success: false, error: "Trash info directory not found" };
  }

  const entries = [];
  for (const fileName of infoFiles) {
    if (!fileName.endsWith(".trashinfo")) continue;
    const infoPath = path.join(trashInfoDir, fileName);
    let content = "";
    try {
      content = await fs.readFile(infoPath, "utf8");
    } catch {
      continue;
    }

    let original = "";
    let deletedAt = "";
    for (const line of content.split(/\r?\n/)) {
      if (line.startsWith("Path=")) {
        original = decodePath(line.slice(5).trim());
      } else if (line.startsWith("DeletionDate=")) {
        deletedAt = line.slice(13).trim();
      }
    }
    if (!original) continue;

    const trashName = fileName.replace(/\.trashinfo$/i, "");
    entries.push({
      original: normalizePath(original),
      deletedAt: deletedAt ? Date.parse(deletedAt) : 0,
      trashName,
      infoPath,
    });
  }

  const entryMap = new Map();
  for (const entry of entries) {
    const existing = entryMap.get(entry.original);
    if (!existing || entry.deletedAt > existing.deletedAt) {
      entryMap.set(entry.original, entry);
    }
  }

  const restored = [];
  const failed = [];

  for (const rawPath of list) {
    const original = normalizePath(rawPath);
    const entry = entryMap.get(original);
    if (!entry) {
      failed.push({ path: rawPath, error: "Item not found in Trash" });
      continue;
    }

    const trashedPath = path.join(trashFilesDir, entry.trashName);
    let stats;
    try {
      stats = await fs.stat(trashedPath);
    } catch (error) {
      failed.push({ path: rawPath, error: "Trashed item missing" });
      continue;
    }

    let targetPath = original || rawPath;
    try {
      await fs.access(targetPath);
      targetPath = await findUniquePath(
        targetPath,
        stats.isDirectory() ? "folder" : "file",
      );
    } catch { }

    try {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.rename(trashedPath, targetPath);
      try {
        await fs.unlink(entry.infoPath);
      } catch { }
      restored.push({ from: trashedPath, to: targetPath });
    } catch (error) {
      try {
        if (stats.isDirectory()) {
          await copyDirectory(trashedPath, targetPath);
          await fs.rm(trashedPath, { recursive: true, force: true });
        } else {
          await fs.copyFile(trashedPath, targetPath);
          await fs.unlink(trashedPath);
        }
        try {
          await fs.unlink(entry.infoPath);
        } catch { }
        restored.push({ from: trashedPath, to: targetPath });
      } catch (fallbackError) {
        failed.push({
          path: rawPath,
          error: fallbackError.message || "Restore failed",
        });
      }
    }
  }

  return { success: failed.length === 0, restored, failed };
});

ipcMain.handle("rename-item", async (event, oldPath, newName) => {
  try {
    const dirName = path.dirname(oldPath);
    const newPath = path.join(dirName, newName);
    await fs.rename(oldPath, newPath);
    return { success: true, newPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("create-folder", async (event, parentPath, folderName) => {
  try {
    const basePath = path.resolve(parentPath);
    const desiredPath = path.join(basePath, folderName);

    try {
      await fs.mkdir(desiredPath, { recursive: false });
      return { success: true, path: desiredPath };
    } catch (err) {
      if (err && (err.code === "EEXIST" || err.code === "ENOTEMPTY")) {
        const uniquePath = await findUniquePath(desiredPath, "folder");
        await fs.mkdir(uniquePath, { recursive: false });
        return { success: true, path: uniquePath };
      }

      if (err && err.code === "ENOENT") {
        await fs.mkdir(basePath, { recursive: true });
        try {
          await fs.mkdir(desiredPath, { recursive: false });
          return { success: true, path: desiredPath };
        } catch (err2) {
          if (err2 && (err2.code === "EEXIST" || err2.code === "ENOTEMPTY")) {
            const uniquePath = await findUniquePath(desiredPath, "folder");
            await fs.mkdir(uniquePath, { recursive: false });
            return { success: true, path: uniquePath };
          }
          throw err2;
        }
      }
      throw err;
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("create-file", async (event, parentPath, fileName) => {
  try {
    const basePath = path.resolve(parentPath);
    const desiredPath = path.join(basePath, fileName);

    await fs.mkdir(basePath, { recursive: true });

    try {
      const fh = await fs.open(desiredPath, "wx");
      await fh.close();
      return { success: true, path: desiredPath };
    } catch (err) {
      if (err && err.code === "EEXIST") {
        const uniquePath = await findUniquePath(desiredPath, "file");
        const fh = await fs.open(uniquePath, "wx");
        await fh.close();
        return { success: true, path: uniquePath };
      }
      throw err;
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

function formatBytesCompact(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

async function findUniquePath(desiredPath, kind) {
  const dir = path.dirname(desiredPath);
  const parsed = path.parse(desiredPath);

  const baseName = kind === "file" ? parsed.name : parsed.base;
  const ext = kind === "file" ? parsed.ext : "";

  for (let i = 1; i < 10000; i++) {
    const candidateName = `${baseName} (${i})${ext}`;
    const candidatePath = path.join(dir, candidateName);
    try {
      await fs.access(candidatePath);
    } catch {
      return candidatePath;
    }
  }

  throw new Error("Could not find a unique name");
}

ipcMain.handle("copy-item", async (event, sourcePath, destPath) => {
  try {
    const stats = await fs.stat(sourcePath);
    if (stats.isDirectory()) {
      await copyDirectory(sourcePath, destPath);
    } else {
      await fs.copyFile(sourcePath, destPath);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

async function copyDirectory(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  const items = await fs.readdir(source, { withFileTypes: true });

  for (const item of items) {
    const srcPath = path.join(source, item.name);
    const destPath = path.join(destination, item.name);

    if (item.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

ipcMain.handle("move-item", async (event, sourcePath, destPath) => {
  try {
    await fs.rename(sourcePath, destPath);
    return { success: true };
  } catch (error) {
    try {
      const stats = await fs.stat(sourcePath);
      if (stats.isDirectory()) {
        await copyDirectory(sourcePath, destPath);
        await fs.rm(sourcePath, { recursive: true });
      } else {
        await fs.copyFile(sourcePath, destPath);
        await fs.unlink(sourcePath);
      }
      return { success: true };
    } catch (copyError) {
      return { success: false, error: copyError.message };
    }
  }
});

ipcMain.on("start-drag", (event, filePaths) => {
  if (!filePaths || !filePaths.length) return;
  const icon = path.join(__dirname, "icon.png");
  event.sender.startDrag({
    files: filePaths,
    icon,
  });
  event.sender.send("drag-ended");
});

ipcMain.handle("cancel-operation", async (event, operationId) => {
  if (!operationId) return { success: false, error: "Missing operation id" };
  cancelOperations.add(String(operationId));
  return { success: true };
});

const conflictResolvers = new Map();

ipcMain.on("resolve-file-conflict", (event, resolution) => {
  const resolver = conflictResolvers.get(resolution.operationId);
  if (resolver) {
    conflictResolvers.delete(resolution.operationId);
    resolver(resolution);
  }
});

function askConflictResolution(sender, fileName, destPath, operationId) {
  return new Promise((resolve) => {
    const resolveId = `conflict-${Date.now()}-${Math.random()}`;
    conflictResolvers.set(resolveId, resolve);
    sender.send("file-conflict", {
      resolveId,
      fileName,
      destPath,
      operationId,
    });
  });
}

ipcMain.handle("batch-file-operation", async (event, items, operation, operationId) => {
  activeOperationCount++;
  const cancelKey = operationId ? String(operationId) : null;
  const shouldCancel = () =>
    Boolean(cancelKey && cancelOperations.has(cancelKey));
  const checkCancelled = () => {
    if (shouldCancel()) {
      const err = new Error("Operation cancelled");
      err.code = "CANCELLED";
      throw err;
    }
  };

  let totalBytes = 0;
  let processedBytes = 0;
  let totalFiles = 0;
  let processedFiles = 0;

  const itemSizes = new Map();

  const scan = async (p, rootItemPath) => {
    checkCancelled();
    try {
      const stats = await fs.lstat(p);
      if (stats.isSymbolicLink()) {
        // Count symlink as a tiny item (no traversal)
        totalFiles++;
      } else if (stats.isDirectory()) {
        const children = await fs.readdir(p);
        for (const c of children) await scan(path.join(p, c), rootItemPath);
      } else {
        totalBytes += stats.size;
        totalFiles++;
        itemSizes.set(
          rootItemPath,
          (itemSizes.get(rootItemPath) || 0) + stats.size,
        );
      }
    } catch { }
  };

  for (const item of items) {
    await scan(item.source, item.source);
  }

  // Disk space check for copy operations (skip for same-device moves via rename)
  if (totalBytes > 0 && items.length > 0) {
    try {
      const destDir = path.dirname(items[0].dest);
      const space = await getDiskSpace(destDir);
      if (space && space.free > 0 && totalBytes > space.free) {
        const needed = formatBytesCompact(totalBytes);
        const available = formatBytesCompact(space.free);
        return {
          success: false,
          error: `Not enough disk space. Need ${needed}, available ${available}.`,
        };
      }
    } catch { }
  }

  if (totalBytes === 0) totalBytes = 1;

  const reportProgress = () => {
    const percent = Math.min(100, (processedBytes / totalBytes) * 100);
    event.sender.send("file-operation-progress", percent);
  };

  const preserveMetadata = async (src, dest, stats) => {
    try {
      if (!stats.isSymbolicLink()) {
        await fs.chmod(dest, stats.mode);
      }
    } catch { }
    try {
      if (!stats.isSymbolicLink()) {
        await fs.utimes(dest, stats.atime, stats.mtime);
      }
    } catch { }
  };

  const STREAM_THRESHOLD = 100 * 1024 * 1024; // 100MB
  const PARALLEL_THRESHOLD = 1024 * 1024; // 1MB
  const PARALLEL_LIMIT = 6;

  const streamCopy = (src, dest) => {
    return new Promise((resolve, reject) => {
      const rs = fsSync.createReadStream(src);
      const ws = fsSync.createWriteStream(dest);
      let copied = 0;
      rs.on("data", (chunk) => {
        if (shouldCancel()) { rs.destroy(); ws.destroy(); reject(Object.assign(new Error("Operation cancelled"), { code: "CANCELLED" })); return; }
        copied += chunk.length;
        processedBytes += chunk.length;
        reportProgress();
      });
      rs.on("error", (err) => { ws.destroy(); reject(err); });
      ws.on("error", (err) => { rs.destroy(); reject(err); });
      ws.on("finish", resolve);
      rs.pipe(ws);
    });
  };

  const copyRecursive = async (src, dest) => {
    checkCancelled();
    const stats = await fs.lstat(src);
    if (stats.isSymbolicLink()) {
      const linkTarget = await fs.readlink(src);
      try { await fs.unlink(dest); } catch { }
      await fs.symlink(linkTarget, dest);
      processedFiles++;
      reportProgress();
    } else if (stats.isDirectory()) {
      await fs.mkdir(dest, { recursive: true });
      const children = await fs.readdir(src);

      // Separate small files for parallel copy
      const smallFiles = [];
      const rest = [];
      for (const child of children) {
        const childSrc = path.join(src, child);
        try {
          const cs = await fs.lstat(childSrc);
          if (!cs.isDirectory() && !cs.isSymbolicLink() && cs.size <= PARALLEL_THRESHOLD) {
            smallFiles.push({ child, stats: cs });
          } else {
            rest.push(child);
          }
        } catch {
          rest.push(child);
        }
      }

      // Copy small files in parallel
      for (let i = 0; i < smallFiles.length; i += PARALLEL_LIMIT) {
        checkCancelled();
        const batch = smallFiles.slice(i, i + PARALLEL_LIMIT);
        await Promise.all(batch.map(async ({ child, stats: cs }) => {
          const childSrc = path.join(src, child);
          const childDest = path.join(dest, child);
          await fs.copyFile(childSrc, childDest);
          await preserveMetadata(childSrc, childDest, cs);
          processedBytes += cs.size;
          processedFiles++;
          reportProgress();
        }));
      }

      // Copy rest sequentially
      for (const child of rest) {
        await copyRecursive(path.join(src, child), path.join(dest, child));
      }

      await preserveMetadata(src, dest, stats);
    } else {
      checkCancelled();
      if (stats.size >= STREAM_THRESHOLD) {
        await streamCopy(src, dest);
      } else {
        await fs.copyFile(src, dest);
        processedBytes += stats.size;
      }
      await preserveMetadata(src, dest, stats);
      processedFiles++;
      reportProgress();
    }
  };

  let applyToAll = null; // "replace" | "skip" | "keep-both"

  const resolveConflict = async (item) => {
    try {
      await fs.access(item.dest);
    } catch {
      return item.dest; // no conflict
    }

    // Source and dest are the same file — skip
    if (path.resolve(item.source) === path.resolve(item.dest)) return null;

    if (applyToAll === "replace") return item.dest;
    if (applyToAll === "skip") return null;
    if (applyToAll === "keep-both") {
      const parsed = path.parse(item.dest);
      const isDir = (await fs.stat(item.source)).isDirectory();
      return await findUniquePath(item.dest, isDir ? "directory" : "file");
    }

    const resolution = await askConflictResolution(
      event.sender,
      path.basename(item.dest),
      item.dest,
      operationId,
    );

    if (resolution.applyToAll) {
      applyToAll = resolution.action;
    }

    if (resolution.action === "cancel") {
      const err = new Error("Operation cancelled");
      err.code = "CANCELLED";
      throw err;
    }
    if (resolution.action === "skip") return null;
    if (resolution.action === "keep-both") {
      const parsed = path.parse(item.dest);
      const isDir = (await fs.stat(item.source)).isDirectory();
      return await findUniquePath(item.dest, isDir ? "directory" : "file");
    }
    return item.dest; // replace
  };

  const errors = [];
  let completedItems = 0;
  let skippedItems = 0;

  try {
    for (const item of items) {
      checkCancelled();

      const finalDest = await resolveConflict(item);
      if (finalDest === null) {
        skippedItems++;
        const size = itemSizes.get(item.source) || 0;
        processedBytes += size;
        reportProgress();
        continue;
      }

      try {
        if (operation === "copy") {
          await copyRecursive(item.source, finalDest);
        } else {
          try {
            checkCancelled();
            await fs.rename(item.source, finalDest);

            const size = itemSizes.get(item.source) || 0;
            processedBytes += size;
            reportProgress();
          } catch (renameErr) {
            // Cross-device move: copy then verify before deleting source
            await copyRecursive(item.source, finalDest);

            // Verify copy by comparing sizes
            const srcStats = await fs.lstat(item.source);
            if (srcStats.isDirectory()) {
              // For directories, just check dest exists
              await fs.access(finalDest);
            } else if (!srcStats.isSymbolicLink()) {
              const destStats = await fs.lstat(finalDest);
              if (destStats.size !== srcStats.size) {
                await fs.rm(finalDest, { recursive: true, force: true });
                throw new Error(`Size mismatch after copy: ${path.basename(item.source)}`);
              }
            }

            await fs.rm(item.source, { recursive: true, force: true });
          }
        }
        completedItems++;
      } catch (itemErr) {
        if (itemErr?.code === "CANCELLED") throw itemErr;
        errors.push({ path: item.source, error: itemErr.message });
        const size = itemSizes.get(item.source) || 0;
        processedBytes += size;
        reportProgress();
      }
    }

    if (errors.length > 0 && completedItems === 0) {
      return {
        success: false,
        error: `All ${errors.length} item(s) failed: ${errors[0].error}`,
        errors,
      };
    }

    return {
      success: true,
      completed: completedItems,
      skipped: skippedItems,
      errors,
    };
  } catch (error) {
    if (error?.code === "CANCELLED") {
      return { success: false, cancelled: true, error: "Cancelled" };
    }
    return { success: false, error: error.message };
  } finally {
    activeOperationCount = Math.max(0, activeOperationCount - 1);
    if (cancelKey) {
      cancelOperations.delete(cancelKey);
    }
  }
});

ipcMain.handle("get-item-info", async (event, itemPath) => {
  const { exec } = require("child_process");
  const util = require("util");
  const execPromise = util.promisify(exec);
  const plat = process.platform;

  try {
    let stats;
    try {
      stats = await fs.stat(itemPath);
    } catch {
      stats = await fs.lstat(itemPath);
    }
    let size = stats.size;
    let fileCount = null;

    if (stats.isDirectory()) {
      size = 0;
      try {
        const entries = await fs.readdir(itemPath);
        fileCount = entries.length;
      } catch { }
    }

    const info = {
      name: path.basename(itemPath),
      path: itemPath,
      size,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      isSymlink: stats.isSymbolicLink ? stats.isSymbolicLink() : false,
      permissions: stats.mode,
      fileCount,
    };

    // Symlink target
    try {
      const lstat = await fs.lstat(itemPath);
      if (lstat.isSymbolicLink()) {
        info.isSymlink = true;
        info.symlinkTarget = await fs.readlink(itemPath);
      }
    } catch { }

    // MIME type from extension
    const ext = path.extname(itemPath).toLowerCase().replace(".", "");
    const mimeMap = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
      webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", ico: "image/x-icon",
      mp4: "video/mp4", mkv: "video/x-matroska", webm: "video/webm", mov: "video/quicktime",
      avi: "video/x-msvideo", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
      flac: "audio/flac", m4a: "audio/mp4", pdf: "application/pdf",
      zip: "application/zip", gz: "application/gzip", tar: "application/x-tar",
      "7z": "application/x-7z-compressed", rar: "application/x-rar-compressed",
      js: "text/javascript", ts: "text/typescript", json: "application/json",
      html: "text/html", css: "text/css", xml: "text/xml", txt: "text/plain",
      md: "text/markdown", py: "text/x-python", rs: "text/x-rust",
      c: "text/x-c", cpp: "text/x-c++", java: "text/x-java",
      doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      exe: "application/x-executable", dll: "application/x-msdownload",
      ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2",
    };
    info.mimeType = info.isDirectory ? "inode/directory" : (mimeMap[ext] || "application/octet-stream");

    // OS-specific extensions
    if (plat === "win32") {
      try {
        const { stdout } = await execPromise(`attrib "${itemPath}"`, { windowsHide: true, timeout: 3000 });
        const line = stdout.trim();
        const attrs = [];
        if (/\bR\b/.test(line)) attrs.push("Read-only");
        if (/\bH\b/.test(line)) attrs.push("Hidden");
        if (/\bS\b/.test(line)) attrs.push("System");
        if (/\bA\b/.test(line)) attrs.push("Archive");
        info.attributes = attrs.length > 0 ? attrs.join(", ") : "Normal";
      } catch { }
    } else {
      // macOS / Linux: owner, group, permissions string
      try {
        const os = require("os");
        const uid = stats.uid;
        const gid = stats.gid;
        info.owner = uid === os.userInfo().uid ? os.userInfo().username : String(uid);

        // Permission string (rwxr-xr-x)
        const mode = stats.mode;
        const perms = [
          (mode & 0o400) ? "r" : "-", (mode & 0o200) ? "w" : "-", (mode & 0o100) ? "x" : "-",
          (mode & 0o040) ? "r" : "-", (mode & 0o020) ? "w" : "-", (mode & 0o010) ? "x" : "-",
          (mode & 0o004) ? "r" : "-", (mode & 0o002) ? "w" : "-", (mode & 0o001) ? "x" : "-",
        ].join("");
        info.permissionsString = perms;

        // Group name via id command
        try {
          const { stdout: grpOut } = await execPromise(`id -gn ${uid}`, { timeout: 2000 });
          info.group = grpOut.trim();
        } catch {
          info.group = String(gid);
        }
      } catch { }
    }

    return { success: true, info };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

async function getDirectorySize(dirPath) {
  let size = 0;
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dirPath, item.name);
      try {
        if (item.isDirectory()) {
          size += await getDirectorySize(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          size += stats.size;
        }
      } catch (err) { }
    }
  } catch (err) { }
  return size;
}

ipcMain.handle("clipboard-copy-paths", async (event, paths) => {
  try {
    const list = Array.isArray(paths) ? paths.filter(Boolean) : [];
    if (list.length === 0)
      return { success: false, error: "No paths provided" };

    clipboard.writeText(list.join("\n"));

    try {
      clipboard.write({
        text: list.join("\n"),

        "text/uri-list": list.map(toFileUrl).join("\n"),
      });
    } catch { }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});


async function handleArchiveBrowsing(fullPath) {
  let archivePath = fullPath;
  let internalPath = "";
  let found = false;

  let depth = 0;
  while (depth < 20) {
    try {
      const stats = await fs.stat(archivePath);
      if (stats.isFile()) {
        found = true;
        break;
      } else if (stats.isDirectory()) {
        return { success: false, error: "Not a directory" };
      }
    } catch (e) {
      const parent = path.dirname(archivePath);
      if (parent === archivePath) break;
      const base = path.basename(archivePath);
      internalPath = internalPath ? path.join(base, internalPath) : base;
      archivePath = parent;
    }
    depth++;
  }

  if (!found) return { success: false, error: "Path not found" };

  const archiveExts = /\.(zip|tar|gz|bz2|xz|7z|rar|tgz|txz|tbz2|cab|iso|lz|lzma|zst)$/i;
  if (!archiveExts.test(archivePath)) {
    return { success: false, error: "Not a directory" };
  }

  const { exec } = require("child_process");
  const util = require("util");
  const execPromise = util.promisify(exec);
  const normalizedInternal = internalPath.replace(/\\/g, "/");

  try {
    const contents = [];
    const seen = new Set();

    const safeArchivePath = archivePath.replace(/"/g, '\\"');
    const isCompressedTar = /\.(tar\.(gz|xz|bz2)|tgz|txz|tbz2)$/i.test(archivePath);

    const q7z = `"${path7za}"`;
    let cmd = `${q7z} l -slt -ba -sccUTF-8 "${safeArchivePath}"`;
    if (isCompressedTar) {
      cmd = `${q7z} x -so "${safeArchivePath}" | ${q7z} l -slt -ba -sccUTF-8 -si -ttar`;
    }

    const { stdout } = await execPromise(cmd, { maxBuffer: 10 * 1024 * 1024 });

    const blocks = stdout.split(/\r?\n\r?\n/);
    for (const block of blocks) {
      const entry = {};
      block.split(/\r?\n/).forEach((line) => {
        const match = line.match(/^(\w+)\s=\s(.*)$/);
        if (match) entry[match[1]] = match[2];
      });
      if (!entry.Path) continue;
      const entryPath = entry.Path.replace(/\\/g, "/");
      if (normalizedInternal && !entryPath.startsWith(normalizedInternal + "/")) continue;
      const relative = normalizedInternal ? entryPath.slice(normalizedInternal.length + 1) : entryPath;
      if (!relative) continue;
      const parts = relative.split("/");
      const name = parts[0];
      if (seen.has(name)) continue;
      seen.add(name);
      const isDir = parts.length > 1 || (entry.Attributes && entry.Attributes.includes("D"));
      contents.push({
        name, path: path.join(fullPath, name), isDirectory: isDir, isFile: !isDir,
        isSymlink: false, hidden: name.startsWith("."),
        size: isDir ? 0 : parseInt(entry.Size || "0", 10),
        modified: entry.Modified ? new Date(entry.Modified) : null,
        created: null, extension: isDir ? null : path.extname(name).toLowerCase(),
      });
    }

    contents.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    return { success: true, contents, path: fullPath, isArchive: true };
  } catch (err) {
    return {
      success: false,
      error: err.message || "Failed to read archive",
    };
  }
}

ipcMain.handle("extract-archive", async (event, archivePath, destPath) => {
  const { promisify } = require("util");
  const execAsync = promisify(execFile);

  try {
    const baseName = path.basename(archivePath);

    let outputDir = path.join(
      destPath,
      baseName
        .replace(/\.(zip|tar|gz|bz2|xz|7z|rar|tgz)$/gi, "")
        .replace(/\.tar$/i, ""),
    );

    try {
      await fs.mkdir(outputDir, { recursive: true });
      await execAsync(path7za, ["x", archivePath, `-o${outputDir}`, "-y"]);
      return { success: true, outputDir };
    } catch (cmdError) {
      return { success: false, error: cmdError.message || cmdError.stderr || "Extraction failed" };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("compress-items", async (event, paths, outputPath) => {
  const { promisify } = require("util");
  const execAsync = promisify(execFile);

  try {
    try {
      await execAsync(path7za, ["a", outputPath, ...paths]);
      return { success: true };
    } catch (cmdError) {
      return {
        success: false,
        error: cmdError.message || cmdError.stderr || "Compression failed",
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});


async function getDiskSpace(pathStr) {
  try {
    if (fs.statfs) {
      const stats = await fs.statfs(pathStr);
      return {
        total: stats.blocks * stats.bsize,
        free: stats.bavail * stats.bsize,
      };
    }
  } catch { }

  const { exec } = require("child_process");
  const util = require("util");
  const execPromise = util.promisify(exec);

  let cmd = "";
  try {
    if (process.platform === "win32") {
      const driveLetter = pathStr.substring(0, 2);
      cmd = `wmic logicaldisk where "DeviceID='${driveLetter}'" get FreeSpace,Size /format:value`;
      const { stdout } = await execPromise(cmd);
      const sizeMatch = stdout.match(/Size=(\d+)/);
      const freeMatch = stdout.match(/FreeSpace=(\d+)/);
      if (sizeMatch && freeMatch) {
        return {
          total: parseInt(sizeMatch[1], 10),
          free: parseInt(freeMatch[1], 10),
        };
      }
    } else {
      cmd = `df -kP "${pathStr}"`;
      const { stdout } = await execPromise(cmd);
      const lines = stdout.trim().split("\n");
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        if (parts.length >= 4) {
          return {
            total: parseInt(parts[1], 10) * 1024,
            free: parseInt(parts[3], 10) * 1024,
          };
        }
      }
    }
  } catch (error) {
    logCommandFailure(cmd, error);
  }
  return null;
}

ipcMain.handle("get-drives", async () => {
  if (process.platform === "win32") {
    const drives = [];
    for (let i = 65; i <= 90; i++) {
      const drive = String.fromCharCode(i) + ":\\";
      try {
        await fs.access(drive);
        const space = await getDiskSpace(drive);
        drives.push({ name: drive, path: drive, mounted: true, space });
      } catch (err) { }
    }
    return drives;
  } else {
    const { exec } = require("child_process");
    const util = require("util");
    const execPromise = util.promisify(exec);

    const drives = [];

    let cmd = "lsblk -J -o NAME,SIZE,TYPE,MOUNTPOINT,LABEL,FSTYPE,RO 2>/dev/null";
    try {
      const { stdout } = await execPromise(cmd);
      const data = JSON.parse(stdout);

      const processDevice = (device, parentName = null) => {
        const name = device.name;
        const fullPath = `/dev/${name}`;
        const mountpoint = device.mountpoint;
        const label = device.label;
        const size = device.size;
        const fstype = device.fstype;
        const type = device.type;
        const ro = device.ro === "1" || device.ro === true;

        if (type === "loop" || type === "ram" || type === "rom") return;

        const skipFsTypes = ["swap", "vfat"];
        const skipMountpoints = ["/boot", "/boot/efi", "/efi", "[SWAP]"];
        const skipLabels = ["EFI", "SYSTEM", "Recovery", "RECOVERY", "BIOS"];

        if (
          fstype &&
          skipFsTypes.includes(fstype) &&
          (mountpoint === "[SWAP]" ||
            !mountpoint ||
            skipMountpoints.some((m) => mountpoint?.startsWith(m)))
        )
          return;
        if (mountpoint && skipMountpoints.some((m) => mountpoint.startsWith(m)))
          return;
        if (label && skipLabels.includes(label)) return;

        if (fstype || mountpoint) {
          let displayName = label || name;
          if (size) displayName += ` (${size})`;

          drives.push({
            name: displayName,
            path: mountpoint || fullPath,
            mounted: Boolean(mountpoint),
            size: size,
            device: fullPath,
            fstype: fstype,
            readonly: ro,
          });
        }

        if (device.children) {
          for (const child of device.children) {
            processDevice(child, name);
          }
        }
      };

      if (data.blockdevices) {
        for (const device of data.blockdevices) {
          processDevice(device);
        }
      }
    } catch (err) {
      logCommandFailure(cmd, err);
    }

    if (!drives.some((d) => d.path === "/")) {
      drives.unshift({ name: "Root", path: "/", mounted: true });
    }

    const commonMounts = ["/mnt", "/media", "/Volumes", "/run/media"];
    for (const mount of commonMounts) {
      try {
        await fs.access(mount);
        const items = await fs.readdir(mount, { withFileTypes: true });
        for (const item of items) {
          if (item.isDirectory()) {
            const itemPath = path.join(mount, item.name);

            if (mount === "/run/media") {
              try {
                const subItems = await fs.readdir(itemPath, {
                  withFileTypes: true,
                });
                for (const subItem of subItems) {
                  if (subItem.isDirectory()) {
                    const subPath = path.join(itemPath, subItem.name);
                    if (!drives.some((d) => d.path === subPath)) {
                      drives.push({
                        name: subItem.name,
                        path: subPath,
                        mounted: true,
                      });
                    }
                  }
                }
              } catch (e) { }
            } else if (!drives.some((d) => d.path === itemPath)) {
              drives.push({
                name: item.name,
                path: itemPath,
                mounted: true,
              });
            }
          }
        }
      } catch (err) { }
    }

    for (const d of drives) {
      if (d.mounted && d.path) {
        d.space = await getDiskSpace(d.path);
      }
    }

    return drives;
  }
});

ipcMain.handle("unmount-device", async (event, devicePath, options = {}) => {
  const { exec } = require("child_process");
  const util = require("util");
  const execPromise = util.promisify(exec);

  const getErrorText = (err) =>
    [err?.message, err?.stderr, err?.stdout].filter(Boolean).join("\n");

  const needsAuth = (message) =>
    /not authorized|authentication is required|permission denied|access denied/i.test(
      String(message || ""),
    );

  const runWithSudo = (password) => {
    const { spawn } = require("child_process");
    return new Promise((resolve, reject) => {
      const child = spawn(
        "sudo",
        ["-S", "-p", "", "udisksctl", "unmount", "-b", devicePath],
        { stdio: ["pipe", "pipe", "pipe"] },
      );
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      child.on("error", reject);
      child.on("close", (code) => {
        const output = (stdout + stderr).trim();
        if (code === 0) resolve(output);
        else reject(new Error(output || `Unmount failed (${code})`));
      });
      if (password) {
        child.stdin.write(`${password}\n`);
      }
      child.stdin.end();
    });
  };

  if (options && typeof options.password === "string") {
    try {
      await runWithSudo(options.password);
      return { success: true };
    } catch (error) {
      const detail = getErrorText(error);
      logCommandFailure(`sudo udisksctl unmount -b ${devicePath}`, error);
      return { success: false, error: detail || "Unmount failed" };
    }
  }

  try {
    const cmd = `udisksctl unmount -b ${devicePath} --no-user-interaction 2>&1`;
    await execPromise(cmd);
    return { success: true };
  } catch (error) {
    const detail = getErrorText(error);
    logCommandFailure(
      `udisksctl unmount -b ${devicePath} --no-user-interaction`,
      error,
    );
    if (needsAuth(detail)) {
      return { success: false, needsAuth: true, error: detail };
    }
    try {
      const cmd = `gio mount -u ${devicePath} 2>&1`;
      await execPromise(cmd);
      return { success: true };
    } catch (gioErr) {
      logCommandFailure(`gio mount -u ${devicePath}`, gioErr);
      try {
        const cmd = `umount ${devicePath} 2>&1`;
        await execPromise(cmd);
        return { success: true };
      } catch (umountErr) {
        logCommandFailure(`umount ${devicePath}`, umountErr);
        return { success: false, error: error.message || "Unmount failed" };
      }
    }
  }
});

ipcMain.handle("mount-device", async (event, devicePath, options = {}) => {
  const { exec } = require("child_process");
  const util = require("util");
  const execPromise = util.promisify(exec);

  const parseMountPoint = (output) => {
    const match = String(output || "").match(/at (.+?)\.?\s*$/);
    return match ? match[1].trim() : null;
  };

  const getErrorText = (err) =>
    [err?.message, err?.stderr, err?.stdout].filter(Boolean).join("\n");

  const needsAuth = (message) =>
    /not authorized|authentication is required|permission denied|access denied/i.test(
      String(message || ""),
    );

  const runWithSudo = (password) => {
    const { spawn } = require("child_process");
    return new Promise((resolve, reject) => {
      const child = spawn(
        "sudo",
        ["-S", "-p", "", "udisksctl", "mount", "-b", devicePath],
        { stdio: ["pipe", "pipe", "pipe"] },
      );
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      child.on("error", reject);
      child.on("close", (code) => {
        const output = (stdout + stderr).trim();
        if (code === 0) resolve(output);
        else reject(new Error(output || `Mount failed (${code})`));
      });
      if (password) {
        child.stdin.write(`${password}\n`);
      }
      child.stdin.end();
    });
  };

  if (options && typeof options.password === "string") {
    try {
      const output = await runWithSudo(options.password);
      const mountpoint = parseMountPoint(output);
      return { success: true, mountpoint };
    } catch (error) {
      const detail = getErrorText(error);
      logCommandFailure(`sudo udisksctl mount -b ${devicePath}`, error);
      return { success: false, error: detail || "Mount failed" };
    }
  }

  try {
    const cmd = `udisksctl mount -b ${devicePath} --no-user-interaction 2>&1`;
    const { stdout } = await execPromise(cmd);

    const mountpoint = parseMountPoint(stdout);
    return { success: true, mountpoint };
  } catch (error) {
    const detail = getErrorText(error);
    logCommandFailure(
      `udisksctl mount -b ${devicePath} --no-user-interaction`,
      error,
    );
    const message = detail || error.message || "";
    if (needsAuth(message)) {
      return { success: false, needsAuth: true, error: message };
    }
    try {
      const cmd = `gio mount -d ${devicePath} 2>&1`;
      await execPromise(cmd);

      const cmdLsblk = `lsblk -n -o MOUNTPOINT ${devicePath} 2>/dev/null`;
      const { stdout: lsblkOut } = await execPromise(cmdLsblk);
      const mountpoint = lsblkOut.trim() || null;
      if (mountpoint) {
        return { success: true, mountpoint };
      }
    } catch (gioErr) {
      logCommandFailure(`gio mount -d ${devicePath}`, gioErr);
    }
    return { success: false, error: message || "Mount failed" };
  }
});


ipcMain.handle("eject-device", async (event, devicePath) => {
  const { exec } = require("child_process");
  const util = require("util");
  const execPromise = util.promisify(exec);

  try {
    if (process.platform === "darwin") {
      // macOS: devicePath is mount point (e.g., /Volumes/USB)
      await execPromise(`diskutil eject "${devicePath}"`);
      return { success: true };
    }

    // Linux: Extract the base device (e.g., /dev/sdb from /dev/sdb1)
    const baseDev = devicePath.replace(/\d+$/, "");

    // First unmount all partitions
    try {
      await execPromise(`udisksctl unmount -b "${devicePath}" --no-user-interaction`);
    } catch { /* may already be unmounted */ }

    // Then power off / eject the device
    try {
      await execPromise(`udisksctl power-off -b "${baseDev}" --no-user-interaction`);
      return { success: true };
    } catch {
      try {
        await execPromise(`eject "${baseDev}"`);
        return { success: true };
      } catch (ejectErr) {
        return { success: false, error: ejectErr.message || "Eject failed" };
      }
    }
  } catch (error) {
    return { success: false, error: error.message || "Eject failed" };
  }
});

ipcMain.handle("show-open-dialog", async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle("show-save-dialog", async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});


ipcMain.handle("read-file-preview", async (event, filePath) => {
  try {
    const stats = await fs.stat(filePath);

    const MAX_PREVIEW_SIZE = 1024 * 1024;
    if (stats.size > MAX_PREVIEW_SIZE) {
      return { success: false, error: "File too large for preview" };
    }

    const ext = path.extname(filePath).toLowerCase();
    const textExtensions = [
      ".txt",
      ".md",
      ".json",
      ".xml",
      ".html",
      ".css",
      ".js",
      ".ts",
      ".py",
      ".java",
      ".c",
      ".cpp",
      ".h",
      ".hpp",
      ".rs",
      ".go",
      ".rb",
      ".php",
      ".sh",
      ".bat",
      ".yml",
      ".yaml",
      ".ini",
      ".conf",
      ".log",
      ".csv",
      ".tsv",
      ".sql",
      ".rtf",
      ".tex",
      ".latex",
    ];

    if (!textExtensions.includes(ext)) {
      return {
        success: false,
        error: "File type not supported for text preview",
      };
    }

    const content = await fs.readFile(filePath, "utf8");
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-image-metadata", async (event, filePath) => {
  try {
    const stats = await fs.stat(filePath);
    let dimensions = null;

    try {
      dimensions = sizeOf(filePath);
    } catch (e) { }

    return {
      success: true,
      metadata: {
        width: dimensions?.width,
        height: dimensions?.height,
        type: dimensions?.type,
        orientation: dimensions?.orientation,
        hasAlpha: dimensions?.hasAlpha,
        fileSize: stats.size,
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-video-metadata", async (event, filePath) => {
  try {
    const stats = await fs.stat(filePath);
    const { exec } = require("child_process");
    const util = require("util");
    const execPromise = util.promisify(exec);


    const MAX_SIZE_FOR_FFPROBE = 500 * 1024 * 1024; // 500MB
    if (stats.size > MAX_SIZE_FOR_FFPROBE) {
      return {
        success: true,
        metadata: {
          fileSize: stats.size,
          note: "File too large for metadata extraction",
        },
      };
    }

    try {
      const cmd = `timeout 5 ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}" 2>/dev/null`;
      const { stdout } = await execPromise(cmd);
      const data = JSON.parse(stdout);

      const videoStream = data.streams?.find((s) => s.codec_type === "video");
      const audioStream = data.streams?.find((s) => s.codec_type === "audio");
      const format = data.format;

      return {
        success: true,
        metadata: {
          duration: format?.duration ? parseFloat(format.duration) : null,
          fileSize: stats.size,
          bitrate: format?.bit_rate ? parseInt(format.bit_rate) : null,
          videoCodec: videoStream?.codec_name || null,
          videoWidth: videoStream?.width || null,
          videoHeight: videoStream?.height || null,
          videoFps: videoStream?.r_frame_rate
            ? (() => {
              const parts = videoStream.r_frame_rate.split("/");
              if (parts.length === 2) {
                return parseFloat(parts[0]) / parseFloat(parts[1]);
              }
              return parseFloat(videoStream.r_frame_rate);
            })()
            : null,
          audioCodec: audioStream?.codec_name || null,
          audioChannels: audioStream?.channels || null,
          audioSampleRate: audioStream?.sample_rate || null,
        },
      };
    } catch (ffprobeError) {
      logCommandFailure(
        `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`,
        ffprobeError,
      );
      return {
        success: true,
        metadata: {
          fileSize: stats.size,
          note: "Install ffprobe for detailed video metadata",
        },
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});


ipcMain.handle("get-file-type", async (event, filePath) => {
  try {
    const { exec } = require("child_process");
    const util = require("util");
    const execPromise = util.promisify(exec);

    const cmd = `file -b "${filePath.replace(/"/g, '\\"')}"`;
    const { stdout } = await execPromise(cmd);

    return {
      success: true,
      fileType: stdout.trim()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
