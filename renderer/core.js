var currentPath = "";
var homeDirectory = "";
var startupPathArg = "";
var appHistory = [];
var historyIndex = -1;
var selectedItems = new Set();
var clipboardItems = [];
var clipboardOperation = null;
var clipboardSourcePaneId = null;
var currentItems = [];
var sortBy = "name";
var sortAscending = true;
var showHidden = false;
var calculateFolderSizes = true;
var fileTags = {};
var viewMode = "detailed";
var thumbnailSize = 140;
var showPreviewPane = false;
var groupBy = "none";
var visibleColumns = { size: true, modified: true, added: true };
var viewSettingsCache = {};
var commonDirs = {};
var collapsedGroups = new Set();
var pickerMode = null;

var folderSizeCache = new Map();
var folderSizeQueue = [];
var folderSizeInFlight = new Map();
var folderSizeActive = 0;
var FOLDER_SIZE_CONCURRENCY = 3;
var MAX_FOLDER_SIZE_CACHE_ENTRIES = 1000;
var MAX_VIEW_SETTINGS_CACHE_ENTRIES = 50;
var MAX_ITEMS_BEFORE_VIRTUAL_SCROLL = 500;
var ITEMS_PER_CHUNK = 100;
var renderItemForVirtualScroll = null;
var FOLDER_SIZE_CACHE_TTL_MS = 300000; // 5 minutes

var tabs = [];
var activeTabIndex = -1;
var splitViewEnabled = false;
var activePaneId = "left";
var panes = {};
var activeOperation = null;
var operationQueue = [];
var operationHistory = [];
var operationSequence = 0;
var queuePaused = false;
var OPERATION_HISTORY_LIMIT = 50;
var undoStack = [];
var UNDO_STACK_LIMIT = 20;
var isInTrash = false;
var filteredItems = [];
var renderedItemCount = 0;
var isLoadingMore = false;
var scrollLoadObserver = null;
var fileList = null;
var MAX_HISTORY_LENGTH = 50;
var folderSizeAbortController = null;

var TAG_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "gray",
];

var fileTypes = {
  folder: { label: "Folder", icon: "folder" },
  image: {
    label: "Image",
    icon: "pictures",
    extensions: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"],
  },
  video: {
    label: "Video",
    icon: "videos",
    extensions: ["mp4", "mkv", "webm", "mov", "avi", "wmv", "flv", "m4v"],
  },
  audio: {
    label: "Audio",
    icon: "music",
    extensions: ["mp3", "wav", "ogg", "flac", "m4a", "aac"],
  },
  code: {
    label: "Code",
    icon: "config",
    extensions: [
      "js", "css", "html", "json", "ts", "rs", "py", "c", "cpp", "h", "hpp",
      "md", "txt", "xml", "yaml", "yml", "sh", "bat", "ps1", "sql", "java",
    ],
  },
  archive: {
    label: "Archive",
    icon: "config",
    extensions: ["zip", "tar", "gz", "7z", "rar", "xz"],
  },
  default: { label: "File", icon: "documents" },
};

var groupHeaderRafMap = new Map();
var themeOverrides = {};
var themeControlMap = new Map();
var colorProbe = null;
var themeModal = null;
var themeDraftOverrides = {};
var themeSavedOverridesSnapshot = {};
var themeWalThemesCache = null;

var THEME_VARIABLE_DEFAULTS = {
  "--bg-primary": "rgba(30, 30, 40, 0.05)",
  "--bg-secondary": "rgba(45, 45, 60, 0.05)",
  "--bg-tertiary": "rgba(60, 60, 80, 0.05)",
  "--bg-overlay": "rgba(100, 100, 100, 0.05)",
  "--menu-bg": "rgba(30, 30, 40, 0.6)",
  "--menu-overlay-bg": "rgba(30, 30, 40, 0.7)",
  "--file-row-bg": "rgba(60, 60, 80, 0.08)",
  "--file-row-hover": "rgba(100, 100, 100, 0.18)",
  "--file-row-active": "rgba(100, 100, 100, 0.32)",
  "--bg-hover": "rgba(255, 255, 255, 0.25)",
  "--bg-active": "rgba(100, 100, 100, 0.5)",
  "--modal-backdrop": "rgba(0, 0, 0, 0.5)",
  "--text-primary": "rgba(255, 255, 255, 0.95)",
  "--text-secondary": "rgba(255, 255, 255, 0.7)",
  "--text-muted": "rgba(255, 255, 255, 0.5)",
  "--border-color": "rgba(255, 255, 255, 0.1)",
  "--accent-color": "rgba(100, 100, 100, 0.5)",
  "--accent-hover": "rgba(170, 170, 170, 0.95)",
  "--success-color": "rgba(100, 255, 150, 0.8)",
  "--danger-color": "rgba(255, 100, 100, 0.8)",
  "--shadow": "0 8px 32px rgba(0, 0, 0, 0.3)",
  "--blur-amount": "20px",
};

var BUILTIN_THEME_PRESETS = [
  {
    id: "default",
    name: "Default Glass",
    description: "The current frosted dark look.",
    overrides: {},
  },
  {
    id: "nord-frost",
    name: "Nord Frost",
    description: "Cool blue glass with crisp contrast.",
    overrides: {
      "--bg-primary": "rgba(26, 33, 44, 0.16)",
      "--bg-secondary": "rgba(35, 45, 60, 0.22)",
      "--bg-tertiary": "rgba(49, 62, 82, 0.28)",
      "--bg-overlay": "rgba(31, 42, 57, 0.38)",
      "--menu-bg": "rgba(24, 31, 43, 0.74)",
      "--menu-overlay-bg": "rgba(18, 24, 34, 0.82)",
      "--file-row-bg": "rgba(136, 192, 208, 0.06)",
      "--file-row-hover": "rgba(143, 188, 187, 0.18)",
      "--file-row-active": "rgba(94, 129, 172, 0.42)",
      "--bg-hover": "rgba(143, 188, 187, 0.18)",
      "--bg-active": "rgba(94, 129, 172, 0.42)",
      "--modal-backdrop": "rgba(8, 12, 20, 0.58)",
      "--text-primary": "rgba(236, 239, 244, 0.96)",
      "--text-secondary": "rgba(216, 222, 233, 0.76)",
      "--text-muted": "rgba(216, 222, 233, 0.5)",
      "--border-color": "rgba(136, 192, 208, 0.2)",
      "--accent-color": "rgba(94, 129, 172, 0.68)",
      "--accent-hover": "rgba(129, 161, 193, 0.98)",
      "--success-color": "rgba(163, 190, 140, 0.82)",
      "--danger-color": "rgba(191, 97, 106, 0.82)",
      "--shadow": "0 16px 48px rgba(7, 11, 18, 0.35)",
      "--blur-amount": "24px",
    },
  },
  {
    id: "amber-glow",
    name: "Amber Glow",
    description: "Warm amber glass with lighter panels.",
    overrides: {
      "--bg-primary": "rgba(54, 34, 18, 0.12)",
      "--bg-secondary": "rgba(78, 49, 21, 0.17)",
      "--bg-tertiary": "rgba(108, 63, 24, 0.23)",
      "--bg-overlay": "rgba(145, 92, 43, 0.26)",
      "--menu-bg": "rgba(62, 39, 17, 0.72)",
      "--menu-overlay-bg": "rgba(47, 29, 13, 0.82)",
      "--file-row-bg": "rgba(255, 207, 138, 0.06)",
      "--file-row-hover": "rgba(255, 208, 136, 0.18)",
      "--file-row-active": "rgba(223, 146, 64, 0.48)",
      "--bg-hover": "rgba(255, 208, 136, 0.18)",
      "--bg-active": "rgba(223, 146, 64, 0.48)",
      "--modal-backdrop": "rgba(22, 12, 4, 0.52)",
      "--text-primary": "rgba(255, 243, 222, 0.97)",
      "--text-secondary": "rgba(247, 221, 183, 0.74)",
      "--text-muted": "rgba(247, 221, 183, 0.5)",
      "--border-color": "rgba(255, 207, 138, 0.18)",
      "--accent-color": "rgba(255, 164, 72, 0.72)",
      "--accent-hover": "rgba(255, 195, 123, 0.98)",
      "--success-color": "rgba(166, 226, 161, 0.82)",
      "--danger-color": "rgba(255, 120, 104, 0.82)",
      "--shadow": "0 16px 44px rgba(29, 14, 3, 0.34)",
      "--blur-amount": "22px",
    },
  },
  {
    id: "forest-mist",
    name: "Forest Mist",
    description: "Muted green glass for softer contrast.",
    overrides: {
      "--bg-primary": "rgba(20, 38, 28, 0.12)",
      "--bg-secondary": "rgba(28, 54, 39, 0.18)",
      "--bg-tertiary": "rgba(37, 74, 51, 0.24)",
      "--bg-overlay": "rgba(49, 92, 67, 0.28)",
      "--menu-bg": "rgba(19, 35, 26, 0.74)",
      "--menu-overlay-bg": "rgba(15, 28, 21, 0.82)",
      "--file-row-bg": "rgba(110, 231, 183, 0.05)",
      "--file-row-hover": "rgba(167, 243, 208, 0.14)",
      "--file-row-active": "rgba(52, 211, 153, 0.38)",
      "--bg-hover": "rgba(167, 243, 208, 0.14)",
      "--bg-active": "rgba(52, 211, 153, 0.38)",
      "--modal-backdrop": "rgba(7, 18, 12, 0.56)",
      "--text-primary": "rgba(240, 253, 244, 0.95)",
      "--text-secondary": "rgba(209, 250, 229, 0.74)",
      "--text-muted": "rgba(209, 250, 229, 0.48)",
      "--border-color": "rgba(110, 231, 183, 0.18)",
      "--accent-color": "rgba(52, 211, 153, 0.62)",
      "--accent-hover": "rgba(110, 231, 183, 0.95)",
      "--success-color": "rgba(74, 222, 128, 0.8)",
      "--danger-color": "rgba(248, 113, 113, 0.8)",
      "--shadow": "0 14px 42px rgba(4, 14, 8, 0.34)",
      "--blur-amount": "22px",
    },
  },
  {
    id: "light-frost",
    name: "Light Frost",
    description: "Bright translucent panels for daytime use.",
    overrides: {
      "--bg-primary": "rgba(248, 250, 252, 0.45)",
      "--bg-secondary": "rgba(255, 255, 255, 0.56)",
      "--bg-tertiary": "rgba(241, 245, 249, 0.68)",
      "--bg-overlay": "rgba(226, 232, 240, 0.64)",
      "--menu-bg": "rgba(255, 255, 255, 0.84)",
      "--menu-overlay-bg": "rgba(248, 250, 252, 0.92)",
      "--file-row-bg": "rgba(148, 163, 184, 0.06)",
      "--file-row-hover": "rgba(148, 163, 184, 0.18)",
      "--file-row-active": "rgba(59, 130, 246, 0.24)",
      "--bg-hover": "rgba(148, 163, 184, 0.18)",
      "--bg-active": "rgba(59, 130, 246, 0.24)",
      "--modal-backdrop": "rgba(148, 163, 184, 0.26)",
      "--text-primary": "rgba(15, 23, 42, 0.96)",
      "--text-secondary": "rgba(51, 65, 85, 0.8)",
      "--text-muted": "rgba(71, 85, 105, 0.6)",
      "--border-color": "rgba(148, 163, 184, 0.28)",
      "--accent-color": "rgba(37, 99, 235, 0.62)",
      "--accent-hover": "rgba(59, 130, 246, 0.92)",
      "--success-color": "rgba(22, 163, 74, 0.8)",
      "--danger-color": "rgba(220, 38, 38, 0.78)",
      "--shadow": "0 18px 40px rgba(148, 163, 184, 0.24)",
      "--blur-amount": "18px",
    },
  },
];

var quickAccessItems = [];
var pinnedListEl = null;
var drivesListEl = null;
var tagsListEl = null;
var hasRealTrashFolder = false;

var newFolderBtn = null;
var newFileBtn = null;
var emptyTrashBtn = null;

var draggedItems = [];
var dragSourcePaneId = null;
var isDragging = false;
var dragScrollInterval = null;
var draggedQaId = null;
var dragHoverTimer = null;
var DRAG_HOVER_DELAY = 800;

var thumbnailObserver = null;

var paneHost = null;
var paneDivider = null;
var fileListLeft = null;
var fileListRight = null;
var pathSegments = null;
var searchInput = null;
var itemCountEl = null;
var selectedCountEl = null;
var currentPathEl = null;
var contextMenu = null;
var contextMenuPanel = null;
var contextSubmenu = null;
var contextMenuMode = "background";
var contextSubmenuOpen = false;
var contextPinTargetPath = null;
var contextPinTargetLabel = null;
var contextQuickAccessId = null;

var tabBarEl = null;
var progressBarContainer = null;
var progressBarFill = null;
var viewMenu = null;
var viewModeBtn = null;
var sortBtn = null;
var groupBtn = null;
var settingsMenu = null;
var settingsBtn = null;
var opsToggleBtn = null;
var opsPanel = null;
var opsQueueList = null;
var opsHistoryList = null;
var opsPauseBtn = null;
var opsClearBtn = null;
var opsCloseBtn = null;
var themeModalBody = null;
var themeCloseBtn = null;
var themeResetBtn = null;
var themeSaveBtn = null;
var previewPanel = null;
var previewContent = null;
var previewResizer = null;
var sidebarResizer = null;
var activeMenuType = null;
var progressInterval = null;
var realProgress = 0;
var fakeProgress = 0;
var notificationActive = false;
var notificationQueue = [];

var STARTUP_CACHE_KEY = "startupCacheHome";
var STARTUP_CACHE_MAX_ITEMS = 300;

var COLUMN_WIDTH_STORAGE_KEY = "columnWidthsV1";
var SIDEBAR_WIDTH_STORAGE_KEY = "sidebarWidthV1";
var PREVIEW_WIDTH_STORAGE_KEY = "previewWidthV1";

var COLUMN_DEFAULTS = {
  size: 100,
  modified: 140,
  added: 140,
};

var COLUMN_MIN = {
  size: 70,
  modified: 90,
  added: 90,
};

var EXTERNAL_MOUNT_PREFIXES = ["/run/media", "/media", "/mnt", "/Volumes"];

var sidebarEl = null;

function setupOperationsPanel() {
  if (opsToggleBtn) {
    opsToggleBtn.addEventListener("click", () => {
      if (opsPanel) {
        const isVisible = opsPanel.style.display === "flex";
        opsPanel.style.display = isVisible ? "none" : "flex";
        if (!isVisible) {
          updateOpsPanel();
        }
      }
    });
  }
  if (opsCloseBtn) {
    opsCloseBtn.addEventListener("click", () => {
      if (opsPanel) opsPanel.style.display = "none";
    });
  }
  if (opsPauseBtn) {
    opsPauseBtn.addEventListener("click", () => {
      // Toggle pause state logic would go here
    });
  }
  if (opsClearBtn) {
    opsClearBtn.addEventListener("click", () => {
      // Clear appHistory logic would go here
    });
  }
}

function scheduleIdle(callback) {
  if (window.requestIdleCallback) {
    window.requestIdleCallback(callback);
  } else {
    setTimeout(callback, 1);
  }
}

function updateOpsPanel() {
  // Stub for operations panel update
  const list = document.getElementById("ops-queue-list");
  if (list) {
    // Basic rendering if needed, or leave empty to prevent crash
  }
}

function scheduleOpsRender() {
  if (typeof updateOpsPanel === "function") {
    requestAnimationFrame(updateOpsPanel);
  }
}

function setupThumbnailObserver() {
  if (thumbnailObserver) return;
  try {
    thumbnailObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          // If we had logic to load real thumbnails, it would go here.
          // For now, this stub prevents crashes.
          thumbnailObserver.unobserve(img);
        }
      });
    }, {
      root: document.querySelector('.file-list-container') || null,
      rootMargin: '100px'
    });
  } catch (e) {
    console.warn("Failed to setup thumbnail observer:", e);
  }
}

function clearThumbnailObserver() {
  if (thumbnailObserver) {
    thumbnailObserver.disconnect();
    thumbnailObserver = null;
  }
}

function openThemeCustomizer() {
  themeModal = document.getElementById("theme-modal");
  if (themeModal) {
    themeSavedOverridesSnapshot = { ...themeOverrides };
    themeDraftOverrides = { ...themeOverrides };
    themeModal.classList.add("visible");
    buildThemeModal();
  }
}

function closeThemeCustomizer(options = {}) {
  if (!themeModal) themeModal = document.getElementById("theme-modal");
  if (themeModal) {
    const shouldRevert = options.revert !== false;
    if (shouldRevert) {
      themeDraftOverrides = { ...themeSavedOverridesSnapshot };
      applyThemeOverrides(themeSavedOverridesSnapshot);
    }
    themeModal.classList.remove("visible");
  }
}

function resetThemeToDefaults() {
  themeDraftOverrides = {};
  applyThemeOverrides(themeDraftOverrides);
  buildThemeModal();
}

var CONTEXT_MENU_ICONS = {
  paste: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
  file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 00 2 2h12a2 2 0 00 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  open: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
  cut: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`,
  undo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 00-4-4H4"/></svg>`,
  rename: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4l6 6-3 3v5l-2 2-2-2v-5l-3-3 4-6z"/><path d="M5 21l7-7"/></svg>`,
  unpin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 4l6 6-3 3v5l-2 2-2-2v-5l-3-3 4-6z"/><path d="M5 21l7-7"/><path d="M3 3l18 18"/></svg>`,
  moveUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>`,
  moveDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/></svg>`,
  terminal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  extract: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21,8 21,21 3,21 3,8"/><rect x="1" y="3" width="22" height="5"/><path d="M12 11v6"/><path d="M9 14l3 3 3-3"/></svg>`,
  compress: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21,8 21,21 3,21 3,8"/><rect x="1" y="3" width="22" height="5"/><path d="M12 17v-6"/><path d="M9 14l3-3 3 3"/></svg>`,
};

var TAG_HEX = {
  red: "#ff5f57",
  orange: "#ffbd2e",
  yellow: "#ffcc00",
  green: "#28c940",
  blue: "#3578f6",
  purple: "#bd93f9",
  gray: "#8e8e93",
};

var BUILTIN_ICONS = {
  folder: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>`,
  desktop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  documents: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  downloads: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  pictures: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>`,
  music: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  videos: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23,7 16,12 23,17 23,7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
  config: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
  root: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16"/><path d="M12 4v16"/></svg>`,
};

var THEME_COLOR_GROUPS = [
  {
    title: "Backgrounds",
    items: [
      { label: "App background", varName: "--bg-primary", hint: "Main window" },
      { label: "Toolbar & status", varName: "--bg-secondary", hint: "Top/bottom bars" },
      { label: "Panels", varName: "--bg-tertiary", hint: "Cards and buttons" },
      { label: "Overlays", varName: "--bg-overlay", hint: "Floating surfaces" },
      { label: "Menus", varName: "--menu-bg", hint: "Context + view menus" },
      { label: "Menu overlay", varName: "--menu-overlay-bg", hint: "Menu backplates" },
      { label: "Hover highlight", varName: "--bg-hover", hint: "Hover state" },
      { label: "Active highlight", varName: "--bg-active", hint: "Active state" },
      { label: "Modal backdrop", varName: "--modal-backdrop", hint: "Dim background" },
    ],
  },
  {
    title: "Text & Lines",
    items: [
      { label: "Primary text", varName: "--text-primary", hint: "Main labels" },
      { label: "Secondary text", varName: "--text-secondary", hint: "Subtitles" },
      { label: "Muted text", varName: "--text-muted", hint: "Hints and meta" },
      { label: "Borders", varName: "--border-color", hint: "Dividers" },
    ],
  },
  {
    title: "Accents",
    items: [
      { label: "Accent", varName: "--accent-color", hint: "Highlights" },
      { label: "Accent hover", varName: "--accent-hover", hint: "Active icons" },
      { label: "Success", varName: "--success-color", hint: "Success status" },
      { label: "Danger", varName: "--danger-color", hint: "Warnings" },
    ],
  },
];
var THEME_COLOR_VARS = THEME_COLOR_GROUPS.reduce((acc, group) => {
  for (const item of group.items) acc.push(item.varName);
  return acc;
}, []);
var THEME_BASE_PRESETS = {
  dark: {
    "--bg-primary": "rgba(30, 30, 40, 0.05)",
    "--bg-secondary": "rgba(45, 45, 60, 0.05)",
    "--bg-tertiary": "rgba(60, 60, 80, 0.05)",
    "--bg-overlay": "rgba(100, 100, 100, 0.05)",
    "--menu-bg": "rgba(30, 30, 40, 0.6)",
    "--menu-overlay-bg": "rgba(30, 30, 40, 0.7)",
    "--bg-hover": "rgba(255, 255, 255, 0.25)",
    "--bg-active": "rgba(100, 100, 100, 0.5)",
    "--modal-backdrop": "rgba(0, 0, 0, 0.5)",
    "--text-primary": "rgba(255, 255, 255, 0.95)",
    "--text-secondary": "rgba(255, 255, 255, 0.7)",
    "--text-muted": "rgba(255, 255, 255, 0.5)",
    "--border-color": "rgba(255, 255, 255, 0.1)",
    "--accent-color": "rgba(100, 100, 100, 0.5)",
    "--accent-hover": "rgba(170, 170, 170, 0.95)",
    "--success-color": "rgba(100, 255, 150, 0.8)",
    "--danger-color": "rgba(255, 100, 100, 0.8)",
  },
  light: {
    "--bg-primary": "rgba(245, 245, 250, 0.05)",
    "--bg-secondary": "rgba(250, 250, 252, 0.55)",
    "--bg-tertiary": "rgba(255, 255, 255, 0.45)",
    "--bg-overlay": "rgba(255, 255, 255, 0.65)",
    "--menu-bg": "rgba(255, 255, 255, 0.78)",
    "--menu-overlay-bg": "rgba(255, 255, 255, 0.88)",
    "--bg-hover": "rgba(0, 0, 0, 0.08)",
    "--bg-active": "rgba(0, 0, 0, 0.16)",
    "--modal-backdrop": "rgba(0, 0, 0, 0.5)",
    "--text-primary": "rgba(20, 20, 24, 0.92)",
    "--text-secondary": "rgba(20, 20, 24, 0.68)",
    "--text-muted": "rgba(20, 20, 24, 0.45)",
    "--border-color": "rgba(0, 0, 0, 0.12)",
    "--accent-color": "rgba(0, 0, 0, 0.08)",
    "--accent-hover": "rgba(0, 0, 0, 0.16)",
    "--success-color": "rgba(40, 167, 69, 0.8)",
    "--danger-color": "rgba(220, 53, 69, 0.8)",
  },
};

var QUICK_ACCESS_STORAGE_KEY = "quickAccessItemsV1";
var DEFAULT_BUILTINS = [
  { id: "trash", type: "builtin", key: "trash", label: "Trash" },
  { id: "root", type: "builtin", key: "root", label: "Root" },
  { id: "home", type: "builtin", key: "home", label: "Home" },
  { id: "desktop", type: "builtin", key: "desktop", label: "Desktop" },
  { id: "documents", type: "builtin", key: "documents", label: "Documents" },
  { id: "downloads", type: "builtin", key: "downloads", label: "Downloads" },
  { id: "pictures", type: "builtin", key: "pictures", label: "Pictures" },
  { id: "music", type: "builtin", key: "music", label: "Music" },
  { id: "videos", type: "builtin", key: "videos", label: "Videos" },
  { id: "config", type: "builtin", key: "config", label: ".config" },
];

var BUILTIN_REGISTRY = DEFAULT_BUILTINS.reduce((acc, b) => {
  acc[b.key] = b;
  return acc;
}, {});

function inferBuiltinKeyFromName(name) {
  const n = String(name || "")
    .trim()
    .toLowerCase();
  if (!n) return null;

  const map = {
    trash: "trash",
    "recycle bin": "trash",

    root: "root",
    "/": "root",

    home: "home",
    "~": "home",

    desktop: "desktop",
    documents: "documents",
    downloads: "downloads",
    pictures: "pictures",
    music: "music",
    videos: "videos",

    ".config": "config",
    config: "config",
  };

  return map[n] || null;
}

var quickAccessItems = [];
var pinnedListEl = null;
var drivesListEl = null;
var tagsListEl = null;
var hasRealTrashFolder = false;

var newFolderBtn = null;
var newFileBtn = null;
var emptyTrashBtn = null;

var draggedItems = [];
var dragSourcePaneId = null;
var isDragging = false;
var dragScrollInterval = null;
var draggedQaId = null;
var dragHoverTimer = null;
var DRAG_HOVER_DELAY = 800;

var contextMenuPanel = null;
var contextSubmenu = null;
var contextMenuMode = "background";
var contextSubmenuOpen = false;

var contextPinTargetPath = null;
var contextPinTargetLabel = null;
var contextQuickAccessId = null;

function validateNewItemName(rawName) {
  const name = (rawName ?? "").trim();
  if (!name) return { ok: false, reason: "Name cannot be empty" };

  if (name.includes("/") || name.includes("\\")) {
    return { ok: false, reason: "Name cannot contain / or \\" };
  }

  if (name === "." || name === "..") {
    return { ok: false, reason: "Invalid name" };
  }

  if (/[<>:"|?*]/.test(name)) {
    return {
      ok: false,
      reason: 'Name cannot contain any of: < > : " | ? *',
    };
  }

  return { ok: true, name };
}

function escapeHtmlAttr(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function readLocalStorageBool(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return fallback;
    return value === "true";
  } catch {
    return fallback;
  }
}

function readLocalStorageNumber(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return fallback;
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function readLocalStorageString(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function readLocalStorageJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function applyThemeOverrides(overrides) {
  themeOverrides = { ...(overrides || {}) };
  const root = document.documentElement;
  for (const [key, value] of Object.entries(THEME_VARIABLE_DEFAULTS)) {
    root.style.setProperty(key, value);
  }
  for (const [key, value] of Object.entries(themeOverrides)) {
    if (value !== undefined && value !== null && value !== "") {
      root.style.setProperty(key, value);
    }
  }
}

function saveThemeOverrides() {
  try {
    localStorage.setItem("themeColors", JSON.stringify(themeOverrides));
  } catch { }
}

function ensureColorProbe() {
  if (colorProbe) return colorProbe;
  colorProbe = document.createElement("span");
  colorProbe.style.display = "none";
  document.body.appendChild(colorProbe);
  return colorProbe;
}

function parseRgbValue(value) {
  const match = value.match(/rgba?\(([^)]+)\)/);
  if (!match) return { r: 255, g: 255, b: 255, a: 1 };
  const parts = match[1].split(",").map((part) => part.trim());
  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  const a = parts[3] !== undefined ? Number(parts[3]) : 1;
  return {
    r: Number.isFinite(r) ? r : 255,
    g: Number.isFinite(g) ? g : 255,
    b: Number.isFinite(b) ? b : 255,
    a: Number.isFinite(a) ? a : 1,
  };
}

function normalizeColorValue(value) {
  const probe = ensureColorProbe();
  probe.style.color = "";
  probe.style.color = value || "";
  const computed = getComputedStyle(probe).color;
  return parseRgbValue(computed);
}

function rgbaFromColor(value, alpha) {
  const { r, g, b } = normalizeColorValue(value);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function inferWalVariant(theme) {
  const ref = `${theme?.path || ""} ${theme?.name || ""}`.toLowerCase();
  if (ref.includes("/light/") || ref.includes("\\light\\")) return "light";
  if (ref.includes("/dark/") || ref.includes("\\dark\\")) return "dark";
  return "dark";
}

function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

function hexToRgb(hex) {
  const cleaned = String(hex || "").replace("#", "");
  if (cleaned.length !== 6) return { r: 255, g: 255, b: 255 };
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return { r, g, b };
}

function getThemeValue(key) {
  return themeDraftOverrides[key] || THEME_VARIABLE_DEFAULTS[key] || "";
}

function getThemeRgbaValue(key) {
  return parseRgbValue(getThemeValue(key));
}

function setDraftThemeValue(key, value) {
  if (!value || value === THEME_VARIABLE_DEFAULTS[key]) {
    delete themeDraftOverrides[key];
  } else {
    themeDraftOverrides[key] = value;
  }
}

function applyThemeDraft() {
  applyThemeOverrides(themeDraftOverrides);
}

function saveThemeCustomizer() {
  themeOverrides = { ...themeDraftOverrides };
  saveThemeOverrides();
  themeSavedOverridesSnapshot = { ...themeOverrides };
  closeThemeCustomizer({ revert: false });
}

function buildThemeColorFromHex(hex, alpha, fallback) {
  const { r, g, b } = normalizeColorValue(hex || fallback);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function syncFileRowPaletteFromTheme() {
  const base = getThemeRgbaValue("--bg-tertiary");
  const accent = getThemeRgbaValue("--accent-color");
  const bgAlpha = getThemeRgbaValue("--file-row-bg").a;
  const hoverAlpha = getThemeRgbaValue("--file-row-hover").a;
  const activeAlpha = getThemeRgbaValue("--file-row-active").a;

  setDraftThemeValue(
    "--file-row-bg",
    `rgba(${base.r}, ${base.g}, ${base.b}, ${bgAlpha})`,
  );
  setDraftThemeValue(
    "--file-row-hover",
    `rgba(${accent.r}, ${accent.g}, ${accent.b}, ${hoverAlpha})`,
  );
  setDraftThemeValue(
    "--file-row-active",
    `rgba(${accent.r}, ${accent.g}, ${accent.b}, ${activeAlpha})`,
  );
}

function updateTintFamily(hex) {
  const bgPrimaryAlpha = getThemeRgbaValue("--bg-primary").a;
  const bgSecondaryAlpha = getThemeRgbaValue("--bg-secondary").a;
  const bgTertiaryAlpha = getThemeRgbaValue("--bg-tertiary").a;
  const bgOverlayAlpha = getThemeRgbaValue("--bg-overlay").a;
  const menuBgAlpha = getThemeRgbaValue("--menu-bg").a;
  const menuOverlayAlpha = getThemeRgbaValue("--menu-overlay-bg").a;
  setDraftThemeValue("--bg-primary", buildThemeColorFromHex(hex, bgPrimaryAlpha, hex));
  setDraftThemeValue("--bg-secondary", buildThemeColorFromHex(hex, bgSecondaryAlpha, hex));
  setDraftThemeValue("--bg-tertiary", buildThemeColorFromHex(hex, bgTertiaryAlpha, hex));
  setDraftThemeValue("--bg-overlay", buildThemeColorFromHex(hex, bgOverlayAlpha, hex));
  setDraftThemeValue("--menu-bg", buildThemeColorFromHex(hex, menuBgAlpha, hex));
  setDraftThemeValue("--menu-overlay-bg", buildThemeColorFromHex(hex, menuOverlayAlpha, hex));
  syncFileRowPaletteFromTheme();
}

function updateTextFamily(hex) {
  setDraftThemeValue("--text-primary", buildThemeColorFromHex(hex, 0.96, hex));
  setDraftThemeValue("--text-secondary", buildThemeColorFromHex(hex, 0.76, hex));
  setDraftThemeValue("--text-muted", buildThemeColorFromHex(hex, 0.52, hex));
  setDraftThemeValue("--border-color", buildThemeColorFromHex(hex, 0.18, hex));
}

function updateAccentFamily(hex) {
  const accentAlpha = getThemeRgbaValue("--accent-color").a || 0.65;
  setDraftThemeValue("--accent-color", buildThemeColorFromHex(hex, accentAlpha, hex));
  setDraftThemeValue("--accent-hover", buildThemeColorFromHex(hex, 0.96, hex));
  syncFileRowPaletteFromTheme();
}

function updateOpacityVariable(key, alpha) {
  const current = getThemeRgbaValue(key);
  setDraftThemeValue(key, `rgba(${current.r}, ${current.g}, ${current.b}, ${alpha})`);
}

function updateFileRowOpacity(alpha) {
  updateOpacityVariable("--file-row-bg", alpha);
  const hoverAlpha = Math.min(1, Math.max(alpha + 0.12, 0.12));
  const activeAlpha = Math.min(1, Math.max(alpha + 0.32, 0.22));
  updateOpacityVariable("--file-row-hover", hoverAlpha);
  updateOpacityVariable("--file-row-active", activeAlpha);
}

function createThemePresetButton(preset) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-preset-btn";
  button.innerHTML = `
    <span class="theme-preset-name">${escapeHtml(preset.name)}</span>
    <span class="theme-preset-hint">${escapeHtml(preset.description)}</span>
  `;
  button.addEventListener("click", () => {
    themeDraftOverrides = { ...preset.overrides };
    syncFileRowPaletteFromTheme();
    applyThemeDraft();
    buildThemeModal();
  });
  return button;
}

function createThemeSection(title) {
  const section = document.createElement("div");
  section.className = "theme-section";

  const header = document.createElement("div");
  header.className = "theme-section-title";
  header.textContent = title;
  section.appendChild(header);

  return section;
}

function createThemeRow(label, hint, controls) {
  const row = document.createElement("div");
  row.className = "theme-row";

  const labelWrap = document.createElement("div");
  labelWrap.className = "theme-label";

  const name = document.createElement("div");
  name.className = "theme-name";
  name.textContent = label;

  const sub = document.createElement("div");
  sub.className = "theme-hint";
  sub.textContent = hint;

  labelWrap.appendChild(name);
  labelWrap.appendChild(sub);
  row.appendChild(labelWrap);

  const controlsWrap = document.createElement("div");
  controlsWrap.className = "theme-controls";
  if (Array.isArray(controls)) {
    controls.forEach((control) => controlsWrap.appendChild(control));
  } else if (controls) {
    controlsWrap.appendChild(controls);
  }
  row.appendChild(controlsWrap);
  return row;
}

function createColorControl(value, onInput) {
  const input = document.createElement("input");
  input.type = "color";
  input.className = "theme-color-input";
  input.value = value;
  input.addEventListener("input", () => {
    onInput(input.value);
    applyThemeDraft();
    buildThemeModal();
  });
  return input;
}

function createSliderControl(value, min, max, step, formatValue, onInput) {
  const wrap = document.createElement("div");
  wrap.className = "theme-opacity";

  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "theme-alpha-input";
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.value = String(value);

  const readout = document.createElement("span");
  readout.className = "theme-alpha-value";
  readout.textContent = formatValue(value);

  slider.addEventListener("input", () => {
    const next = Number(slider.value);
    readout.textContent = formatValue(next);
    onInput(next);
    applyThemeDraft();
  });

  wrap.appendChild(slider);
  wrap.appendChild(readout);
  return wrap;
}

function createThemeActionButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "theme-chip-btn";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function applyWalTheme(theme) {
  if (!theme?.special?.background || !theme?.special?.foreground) return;
  const background = theme.special.background;
  const foreground = theme.special.foreground;
  const accent =
    theme.special.cursor ||
    theme.colors?.color4 ||
    theme.colors?.color6 ||
    foreground;
  const overlay = theme.colors?.color0 || background;

  themeDraftOverrides = {
    "--bg-primary": buildThemeColorFromHex(background, 0.16, background),
    "--bg-secondary": buildThemeColorFromHex(background, 0.22, background),
    "--bg-tertiary": buildThemeColorFromHex(overlay, 0.3, overlay),
    "--bg-overlay": buildThemeColorFromHex(overlay, 0.38, overlay),
    "--menu-bg": buildThemeColorFromHex(background, 0.76, background),
    "--menu-overlay-bg": buildThemeColorFromHex(background, 0.84, background),
    "--bg-hover": buildThemeColorFromHex(accent, 0.18, accent),
    "--bg-active": buildThemeColorFromHex(accent, 0.34, accent),
    "--modal-backdrop": buildThemeColorFromHex(background, 0.58, background),
    "--text-primary": buildThemeColorFromHex(foreground, 0.96, foreground),
    "--text-secondary": buildThemeColorFromHex(foreground, 0.76, foreground),
    "--text-muted": buildThemeColorFromHex(foreground, 0.52, foreground),
    "--border-color": buildThemeColorFromHex(foreground, 0.18, foreground),
    "--accent-color": buildThemeColorFromHex(accent, 0.62, accent),
    "--accent-hover": buildThemeColorFromHex(accent, 0.96, accent),
    "--success-color": buildThemeColorFromHex(theme.colors?.color2 || "#5ee38c", 0.82, "#5ee38c"),
    "--danger-color": buildThemeColorFromHex(theme.colors?.color1 || "#ff6b6b", 0.82, "#ff6b6b"),
    "--blur-amount": inferWalVariant(theme) === "light" ? "16px" : "24px",
  };
  syncFileRowPaletteFromTheme();
  applyThemeDraft();
  buildThemeModal();
}

async function loadWalThemes() {
  if (themeWalThemesCache) return themeWalThemesCache;
  try {
    const themes = await window.fileManager.getWalThemes();
    themeWalThemesCache = Array.isArray(themes) ? themes : [];
  } catch (error) {
    console.warn("Failed to load wal themes:", error);
    themeWalThemesCache = [];
  }
  return themeWalThemesCache;
}

async function buildThemeModal() {
  if (!themeModalBody) return;
  themeModalBody.innerHTML = "";
  themeControlMap.clear();

  const presetSection = createThemeSection("Theme Presets");
  const presetGrid = document.createElement("div");
  presetGrid.className = "theme-preset-grid";
  BUILTIN_THEME_PRESETS.forEach((preset) => {
    presetGrid.appendChild(createThemePresetButton(preset));
  });
  presetSection.appendChild(presetGrid);
  themeModalBody.appendChild(presetSection);

  const appearanceSection = createThemeSection("Glass And Transparency");
  const tintHex = rgbToHex(
    getThemeRgbaValue("--bg-secondary").r,
    getThemeRgbaValue("--bg-secondary").g,
    getThemeRgbaValue("--bg-secondary").b,
  );
  const textHex = rgbToHex(
    getThemeRgbaValue("--text-primary").r,
    getThemeRgbaValue("--text-primary").g,
    getThemeRgbaValue("--text-primary").b,
  );
  const accentHex = rgbToHex(
    getThemeRgbaValue("--accent-color").r,
    getThemeRgbaValue("--accent-color").g,
    getThemeRgbaValue("--accent-color").b,
  );
  appearanceSection.appendChild(
    createThemeRow(
      "Base Tint",
      "The main glass color used across panels and menus.",
      createColorControl(tintHex, updateTintFamily),
    ),
  );
  appearanceSection.appendChild(
    createThemeRow(
      "Text Color",
      "Updates primary, secondary, and muted text together.",
      createColorControl(textHex, updateTextFamily),
    ),
  );
  appearanceSection.appendChild(
    createThemeRow(
      "Accent Color",
      "Used for selection, active states, and action buttons.",
      createColorControl(accentHex, updateAccentFamily),
    ),
  );
  appearanceSection.appendChild(
    createThemeRow(
      "Panel Opacity",
      "Higher values make the main window easier to read.",
      createSliderControl(
        getThemeRgbaValue("--bg-secondary").a,
        0.04,
        0.9,
        0.01,
        (value) => `${Math.round(value * 100)}%`,
        (value) => {
          updateOpacityVariable("--bg-primary", Math.max(0.01, value * 0.7));
          updateOpacityVariable("--bg-secondary", value);
          updateOpacityVariable("--bg-tertiary", Math.min(1, value + 0.08));
        },
      ),
    ),
  );
  appearanceSection.appendChild(
    createThemeRow(
      "File Row Opacity",
      "Controls the background behind file names and metadata rows.",
      createSliderControl(
        getThemeRgbaValue("--file-row-bg").a,
        0,
        0.85,
        0.01,
        (value) => `${Math.round(value * 100)}%`,
        (value) => updateFileRowOpacity(value),
      ),
    ),
  );
  appearanceSection.appendChild(
    createThemeRow(
      "Overlay Opacity",
      "Controls menus, modals, and dense surfaces.",
      createSliderControl(
        getThemeRgbaValue("--bg-overlay").a,
        0.04,
        0.98,
        0.01,
        (value) => `${Math.round(value * 100)}%`,
        (value) => {
          updateOpacityVariable("--bg-overlay", value);
          updateOpacityVariable("--menu-bg", Math.min(1, value + 0.26));
          updateOpacityVariable("--menu-overlay-bg", Math.min(1, value + 0.34));
        },
      ),
    ),
  );
  appearanceSection.appendChild(
    createThemeRow(
      "Backdrop Dim",
      "How much the background darkens behind modals.",
      createSliderControl(
        getThemeRgbaValue("--modal-backdrop").a,
        0,
        0.9,
        0.01,
        (value) => `${Math.round(value * 100)}%`,
        (value) => updateOpacityVariable("--modal-backdrop", value),
      ),
    ),
  );
  appearanceSection.appendChild(
    createThemeRow(
      "Blur Strength",
      "Adds or reduces the frosted-glass blur effect.",
      createSliderControl(
        parseInt(getThemeValue("--blur-amount"), 10) || 20,
        0,
        40,
        1,
        (value) => `${value}px`,
        (value) => setDraftThemeValue("--blur-amount", `${value}px`),
      ),
    ),
  );
  themeModalBody.appendChild(appearanceSection);

  const quickSection = createThemeSection("Quick Tuning");
  const quickActions = document.createElement("div");
  quickActions.className = "theme-controls theme-inline-actions";
  quickActions.appendChild(
    createThemeActionButton("More Transparent", () => {
      const next = Math.max(0.04, getThemeRgbaValue("--bg-secondary").a - 0.06);
      updateOpacityVariable("--bg-primary", Math.max(0.01, next * 0.7));
      updateOpacityVariable("--bg-secondary", next);
      updateOpacityVariable("--bg-tertiary", Math.max(0.02, next + 0.08));
      updateFileRowOpacity(Math.max(0, getThemeRgbaValue("--file-row-bg").a - 0.05));
      applyThemeDraft();
      buildThemeModal();
    }),
  );
  quickActions.appendChild(
    createThemeActionButton("More Solid", () => {
      const next = Math.min(0.9, getThemeRgbaValue("--bg-secondary").a + 0.06);
      updateOpacityVariable("--bg-primary", Math.max(0.01, next * 0.7));
      updateOpacityVariable("--bg-secondary", next);
      updateOpacityVariable("--bg-tertiary", Math.min(1, next + 0.08));
      updateFileRowOpacity(Math.min(0.85, getThemeRgbaValue("--file-row-bg").a + 0.05));
      applyThemeDraft();
      buildThemeModal();
    }),
  );
  quickActions.appendChild(
    createThemeActionButton("Sharper Blur", () => {
      const next = Math.min(
        40,
        (parseInt(getThemeValue("--blur-amount"), 10) || 20) + 4,
      );
      setDraftThemeValue("--blur-amount", `${next}px`);
      applyThemeDraft();
      buildThemeModal();
    }),
  );
  quickActions.appendChild(
    createThemeActionButton("Softer Blur", () => {
      const next = Math.max(
        0,
        (parseInt(getThemeValue("--blur-amount"), 10) || 20) - 4,
      );
      setDraftThemeValue("--blur-amount", `${next}px`);
      applyThemeDraft();
      buildThemeModal();
    }),
  );
  quickSection.appendChild(quickActions);
  themeModalBody.appendChild(quickSection);

  const walThemes = await loadWalThemes();
  if (walThemes.length > 0) {
    const walSection = createThemeSection("Wal Themes");
    const select = document.createElement("select");
    select.className = "theme-select";
    walThemes.forEach((theme, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = theme.name || theme.path || `Theme ${index + 1}`;
      select.appendChild(option);
    });
    const applyButton = createThemeActionButton("Apply Wal Theme", () => {
      const selected = walThemes[Number(select.value)];
      if (selected) applyWalTheme(selected);
    });
    walSection.appendChild(
      createThemeRow(
        "Wallpaper Theme",
        "Import a pywal colorscheme from your existing wallpaper themes.",
        [select, applyButton],
      ),
    );
    themeModalBody.appendChild(walSection);
  }
}

function trimCache(cacheMap, maxEntries) {
  if (cacheMap.size <= maxEntries) return;
  const entriesToDelete = cacheMap.size - maxEntries;
  let deleted = 0;
  for (const key of cacheMap.keys()) {
    cacheMap.delete(key);
    deleted++;
    if (deleted >= entriesToDelete) break;
  }
}

function trimObjectCache(cacheObj, maxEntries) {
  const keys = Object.keys(cacheObj);
  if (keys.length <= maxEntries) return;
  const entriesToDelete = keys.length - maxEntries;
  for (let i = 0; i < entriesToDelete; i++) {
    delete cacheObj[keys[i]];
  }
}

function escapeHtmlAttr(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showDeleteChoiceModal(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.setAttribute("data-role", "fm-delete-overlay");
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: var(--modal-backdrop);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 6000;
    `;

    const dialog = document.createElement("div");
    dialog.style.cssText = `
      width: 440px;
      max-width: calc(100vw - 32px);
      background: var(--bg-overlay);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      box-shadow: var(--shadow);
      padding: 16px;
      color: var(--text-primary);
    `;

    dialog.innerHTML = `
      <div style="font-size: 14px; font-weight: 700; margin-bottom: 10px;">${escapeHtmlAttr(title)}</div>
      <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px; line-height: 1.4;">${escapeHtmlAttr(message)}</div>
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button id="fm-del-cancel" style="padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary); cursor: pointer;">Cancel</button>
        <button id="fm-del-trash" style="padding: 8px 12px; border-radius: 8px; border: none; background: var(--accent-color); color: white; cursor: pointer;">Move to Trash</button>
        <button id="fm-del-perm" style="padding: 8px 12px; border-radius: 8px; border: none; background: var(--danger-color); color: white; cursor: pointer;">Delete Permanently</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const finish = (val) => {
      document.body.removeChild(overlay);
      resolve(val);
    };

    overlay.addEventListener("click", (e) => { if (e.target === overlay) finish("cancel"); });
    dialog.querySelector("#fm-del-cancel").onclick = () => finish("cancel");
    dialog.querySelector("#fm-del-trash").onclick = () => finish("trash");
    dialog.querySelector("#fm-del-perm").onclick = () => finish("permanent");
  });
}

function showConfirmModal(title, message, confirmLabel = "Confirm") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed; inset:0; background:var(--modal-backdrop); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; z-index:6000;";
    const dialog = document.createElement("div");
    dialog.style.cssText = "width:400px; background:var(--bg-overlay); border:1px solid var(--border-color); border-radius:14px; padding:16px; color:var(--text-primary);";
    dialog.innerHTML = `
      <div style="font-weight:700; margin-bottom:10px;">${escapeHtmlAttr(title)}</div>
      <div style="font-size:13px; color:var(--text-secondary); margin-bottom:14px;">${escapeHtmlAttr(message)}</div>
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button id="fm-conf-cancel" style="padding:8px 12px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-tertiary); color:var(--text-primary); cursor:pointer;">Cancel</button>
        <button id="fm-conf-ok" style="padding:8px 12px; border-radius:8px; border:none; background:var(--accent-color); color:white; cursor:pointer;">${escapeHtmlAttr(confirmLabel)}</button>
      </div>
    `;
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    const finish = (val) => { document.body.removeChild(overlay); resolve(val); };
    dialog.querySelector("#fm-conf-cancel").onclick = () => finish(false);
    dialog.querySelector("#fm-conf-ok").onclick = () => finish(true);
  });
}

function showTextInputModal(title, message, defaultValue = "", confirmLabel = "OK", type = "text") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed; inset:0; background:var(--modal-backdrop); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; z-index:6000;";
    const dialog = document.createElement("div");
    dialog.style.cssText = "width:400px; background:var(--bg-overlay); border:1px solid var(--border-color); border-radius:14px; padding:16px; color:var(--text-primary);";
    dialog.innerHTML = `
      <div style="font-weight:700; margin-bottom:10px;">${escapeHtmlAttr(title)}</div>
      <div style="font-size:13px; color:var(--text-secondary); margin-bottom:10px;">${escapeHtmlAttr(message)}</div>
      <input type="${type}" id="fm-input-val" style="width:100%; padding:8px; border-radius:6px; background:rgba(0,0,0,0.2); border:1px solid var(--border-color); color:white; margin-bottom:14px;" value="${escapeHtmlAttr(defaultValue)}">
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button id="fm-input-cancel" style="padding:8px 12px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-tertiary); color:var(--text-primary); cursor:pointer;">Cancel</button>
        <button id="fm-input-ok" style="padding:8px 12px; border-radius:8px; border:none; background:var(--accent-color); color:white; cursor:pointer;">${escapeHtmlAttr(confirmLabel)}</button>
      </div>
    `;
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    const input = dialog.querySelector("#fm-input-val");
    input.focus();
    input.select();
    const finish = (val) => { document.body.removeChild(overlay); resolve(val); };
    dialog.querySelector("#fm-input-cancel").onclick = () => finish(null);
    dialog.querySelector("#fm-input-ok").onclick = () => finish(input.value);
    input.onkeydown = (e) => {
      if (e.key === "Enter") finish(input.value);
      if (e.key === "Escape") finish(null);
    };
  });
}

function enqueueOperation(entry) {
  const op = {
    id: `op-${Date.now()}-${operationSequence++}`,
    status: "queued",
    progress: entry.progress ?? 0,
    createdAt: Date.now(),
    ...entry,
  };
  operationQueue.push(op);
  scheduleOpsRender();
  processOperationQueue();
  return op;
}

async function processOperationQueue() {
  if (queuePaused || activeOperation || operationQueue.length === 0) {
    scheduleOpsRender();
    return;
  }
  const op = operationQueue.shift();
  if (!op) return;
  activeOperation = op;
  op.status = "running";
  op.startedAt = Date.now();
  if (op.usesProgress) startProgress();
  scheduleOpsRender();
  try {
    const result = await op.run(op);
    op.status = result?.cancelled ? "cancelled" : "completed";
    if (op.onSuccess) await op.onSuccess(result);
  } catch (err) {
    op.status = err?.cancelled ? "cancelled" : "failed";
    op.error = err.message;
  } finally {
    op.finishedAt = Date.now();
    if (op.usesProgress) finishProgress();
    activeOperation = null;
    operationHistory.unshift(op);
    if (operationHistory.length > OPERATION_HISTORY_LIMIT) operationHistory.length = OPERATION_HISTORY_LIMIT;
    scheduleOpsRender();
    processOperationQueue();
  }
}

function scheduleOpsRender() {
  if (typeof updateOpsPanel === "function") updateOpsPanel();
}

function pushUndo(entry) {
  if (!entry || typeof entry.undo !== "function") return;
  undoStack.push(entry);
  if (undoStack.length > UNDO_STACK_LIMIT) undoStack.shift();
  if (typeof refreshUndoMenu === "function") refreshUndoMenu();
}

function formatOperationLabel(type, count) {
  return `${type} ${count} item${count === 1 ? "" : "s"}`;
}

function formatUndoLabel(type, count) {
  return `Undo ${type} of ${count} item${count === 1 ? "" : "s"}`;
}

async function deletePathsPermanently(paths) {
  for (const p of paths) {
    await window.fileManager.deleteItem(p);
  }
}

async function runBatchOperation(items, operation) {
  const result = await window.fileManager.batchFileOperation(items, operation);
  if (!result || !result.success) throw new Error(result?.error || "Batch operation failed");
}

function startProgress() {
  if (progressBarContainer) progressBarContainer.style.display = "block";
  realProgress = 0;
  fakeProgress = 0;
  updateProgressBar();
  progressInterval = setInterval(() => {
    fakeProgress = Math.min(95, fakeProgress + (100 - fakeProgress) * 0.05);
    updateProgressBar();
  }, 200);
}

function finishProgress() {
  clearInterval(progressInterval);
  realProgress = 100;
  fakeProgress = 100;
  updateProgressBar();
  setTimeout(() => {
    if (progressBarContainer) progressBarContainer.style.display = "none";
  }, 500);
}

function updateProgressBar() {
  const p = Math.max(realProgress, fakeProgress);
  if (progressBarFill) progressBarFill.style.width = p + "%";
}
