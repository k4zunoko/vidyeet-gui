import { app, BrowserWindow, Tray, Menu } from "electron";
import log from "electron-log/main";
import {
  autoUpdater,
  type UpdateDownloadedEvent,
  type UpdateInfo,
  type ProgressInfo,
} from "electron-updater";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  IpcChannels,
  type IpcError,
  type UpdateStatusPayload,
} from "./types/ipc";
import { registerVidyeetHandlers } from "./ipc/vidyeet";
import { registerWindowHandlers } from "./ipc/window";
import { registerClipboardHandlers } from "./ipc/clipboard";
import { registerAppHandlers } from "./ipc/app";
import { registerTemplateHandlers } from "./ipc/templates";
import { registerShellHandlers } from "./ipc/shell";
import {
  registerUpdaterHandlers,
  setMainWindow,
  setUpdaterState,
} from "./ipc/updater";
import { registerAutoLaunchHandlers } from "./ipc/autoLaunch";
import autoLaunchManager from "./services/autoLaunchManager";
import Store from "electron-store";

// Type definition for update state persistence
interface UpdateState {
  hasPendingUpdate: boolean;
  version?: string;
  downloadedAt?: number;
}

// Create store instance at module level (outside app.whenReady())
export const updateStore = new Store<UpdateState>({
  name: "update-state",
  defaults: {
    hasPendingUpdate: false,
  },
});

// 多重起動防止: シングルインスタンスロックを取得
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // ロックが取れない場合は2個目以降のインスタンスなので即終了
  app.quit();
  process.exit(0);
}

// アプリケーション名を設定（electron-log/electron-updaterの初期化前に設定）
app.name = "Vidyeet";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;
let tray: Tray | null = null;
let isQuitting = false;

const BACKGROUND_UPDATE_CHECK_DELAY_MS = 10_000;

type UpdateTrigger = "manual" | "background";

let backgroundUpdateCheckTimer: ReturnType<typeof setTimeout> | null = null;

// State object for updater
const updaterState = {
  updateCheckInProgress: false,
  updateDownloadInProgress: false,
  updateDownloadedInfo: null as UpdateDownloadedEvent | null,
  currentCheckTrigger: null as UpdateTrigger | null,
  currentDownloadTrigger: null as UpdateTrigger | null,
  lastDownloadProgress: null as ProgressInfo | null,
};

function buildUpdateProgress(progress: ProgressInfo) {
  return {
    percent: progress.percent,
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond,
  };
}

function scheduleBackgroundUpdateCheck() {
  if (!app.isPackaged || backgroundUpdateCheckTimer) {
    return;
  }

  backgroundUpdateCheckTimer = setTimeout(() => {
    backgroundUpdateCheckTimer = null;
    runUpdateCheck("background").catch((error) => {
      log.error("autoUpdater background check failed", error);
    });
  }, BACKGROUND_UPDATE_CHECK_DELAY_MS);
}

function clearBackgroundUpdateCheckTimer() {
  if (!backgroundUpdateCheckTimer) {
    return;
  }

  clearTimeout(backgroundUpdateCheckTimer);
  backgroundUpdateCheckTimer = null;
}

async function runUpdateCheck(trigger: UpdateTrigger) {
  if (updaterState.updateCheckInProgress) {
    return;
  }

  updaterState.updateCheckInProgress = true;
  updaterState.currentCheckTrigger = trigger;

  try {
    await autoUpdater.checkForUpdates();
  } finally {
    updaterState.updateCheckInProgress = false;
  }
}

function sendUpdateStatus(payload: UpdateStatusPayload) {
  win?.webContents.send(IpcChannels.UPDATE_STATUS, payload);
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = log;
  log.transports.file.level = "info";

  autoUpdater.on("checking-for-update", () => {
    sendUpdateStatus({ status: "checking-for-update" });
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    sendUpdateStatus({ status: "update-available", info });
    const shouldAutoDownload = updaterState.currentCheckTrigger === "background";
    updaterState.currentCheckTrigger = null;

    if (!shouldAutoDownload || updaterState.updateDownloadInProgress) {
      return;
    }

    updaterState.currentDownloadTrigger = "background";
    updaterState.updateDownloadInProgress = true;

    autoUpdater.downloadUpdate().catch((error) => {
      updaterState.updateDownloadInProgress = false;
      updaterState.currentDownloadTrigger = null;
      log.error("autoUpdater background download failed", error);
    });
  });

  autoUpdater.on("update-not-available", (info: UpdateInfo) => {
    sendUpdateStatus({ status: "update-not-available", info });
    updaterState.currentCheckTrigger = null;
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    updaterState.lastDownloadProgress = progress;
    updaterState.updateDownloadInProgress = true;

    if (updaterState.currentDownloadTrigger === "background") {
      return;
    }

    sendUpdateStatus({
      status: "download-progress",
      progress: buildUpdateProgress(progress),
    });
  });

  autoUpdater.on("update-downloaded", (info: UpdateDownloadedEvent) => {
    updaterState.updateDownloadInProgress = false;
    updaterState.updateDownloadedInfo = info;
    updaterState.currentDownloadTrigger = null;
    updaterState.lastDownloadProgress = null;
    sendUpdateStatus({ status: "update-downloaded", info });
    updateStore.set("updateState", {
      hasPendingUpdate: true,
      version: info.version,
      downloadedAt: Date.now(),
    });
  });

  autoUpdater.on("error", (error: unknown) => {
    updaterState.updateCheckInProgress = false;
    updaterState.updateDownloadInProgress = false;
    updaterState.currentCheckTrigger = null;
    updaterState.currentDownloadTrigger = null;
    updaterState.lastDownloadProgress = null;
    const details = normalizeAutoUpdateErrorDetails(error);
    const resolved = resolveAutoUpdateError(
      details,
      "更新の処理に失敗しました。ネットワークを確認して再試行してください。",
    );
    log.error("autoUpdater error", error);
    sendUpdateStatus({ status: "error", error: resolved.message });
  });
}

function normalizeAutoUpdateErrorDetails(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolveAutoUpdateError(
  details: string,
  fallbackMessage: string,
): Pick<IpcError, "code" | "message"> {
  const normalized = details.toLowerCase();

  if (normalized.includes("app-update.yml") && normalized.includes("enoent")) {
    return {
      code: "AUTO_UPDATE_CONFIG_MISSING",
      message:
        "更新情報が見つかりませんでした。インストール済みのアプリから実行してください。",
    };
  }

  if (
    normalized.includes("unable to find latest version on github") ||
    normalized.includes("cannot parse releases feed") ||
    normalized.includes("releases/latest")
  ) {
    return {
      code: "AUTO_UPDATE_RELEASE_NOT_FOUND",
      message:
        "最新のリリースが公開されていないため、更新を確認できません。公開後に再試行してください。",
    };
  }

  return {
    code: "AUTO_UPDATE_ERROR",
    message: fallbackMessage,
  };
}

function createTray(): void {
  // アイコンパスを解決
  // 開発時: public/icon.ico (Viteのpublicフォルダ)
  // 本番時: dist/icon.ico (Viteがpublicをdistにコピー)
  const appRoot = process.env.APP_ROOT ?? path.join(__dirname, "..");
  const iconPath = VITE_DEV_SERVER_URL
    ? path.join(appRoot, "public", "icon.ico")
    : path.join(RENDERER_DIST, "icon.ico");

  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Vidyeetを表示",
      click: () => {
        if (win) {
          win.show();
          win.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Vidyeet");
  tray.setContextMenu(contextMenu);

  // トレイアイコンクリックでウィンドウの表示/非表示を切り替え
  tray.on("click", () => {
    if (win) {
      if (win.isVisible()) {
        win.hide();
      } else {
        win.show();
        win.focus();
      }
    } else {
      createWindow();
    }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false, // フレームレス
    titleBarStyle: "hidden",
    title: "Vidyeet", // ウィンドウタイトル
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  // 閉じるボタンが押されたときにタスクトレイに格納
  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win?.hide();
    }
  });

  // ウィンドウが非表示になったときにレンダラープロセスに通知
  win.on("hide", () => {
    win?.webContents.send(IpcChannels.APP_WINDOW_HIDDEN);
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // 実際に終了する場合（トレイメニューからQuitが選択された）のみ終了
    // 通常のウィンドウ閉じる操作ではトレイに格納される
    if (isQuitting) {
      app.quit();
    }
    win = null;
  }
});

// アプリが実際に終了するときにフラグを設定
app.on("before-quit", () => {
  isQuitting = true;
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 2個目以降のインスタンス起動時に既存ウィンドウを前面に表示
app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
    win.focus();
  } else {
    // App was started in tray-only mode (--hidden)
    // Create window when user launches from shortcut
    createWindow();
  }
});

// Detect if app was auto-started (launched with --hidden flag)
const isAutoStarted = autoLaunchManager.isAutoStarted();

app.whenReady().then(async () => {
  // Register event handlers FIRST (required for checkForUpdates to work)
  setupAutoUpdater();
  
  // Check for pending update AFTER handlers are registered
  let updateState: UpdateState | undefined;
  try {
    updateState = updateStore.get("updateState") as UpdateState | undefined;
  } catch (error) {
    log.warn("[AutoUpdate] Failed to read update state from store, continuing normal startup:", error);
    continueStartup();
    return;
  }

  if (updateState?.hasPendingUpdate) {
    log.info("[AutoUpdate] Pending update detected on startup:", updateState.version);
    log.info("[AutoUpdate] Calling checkForUpdates to load cached update...");
    
    let cacheLoaded = false;
    
    // Listen for update-downloaded event (cache hit)
    const cacheLoadHandler = () => {
      cacheLoaded = true;
      log.info("[AutoUpdate] Cached update loaded successfully");
    };
    autoUpdater.once("update-downloaded", cacheLoadHandler);
    
    // Set timeout - 30 seconds for network-dependent checkForUpdates
    const installTimeout = setTimeout(() => {
      autoUpdater.off("update-downloaded", cacheLoadHandler);
      if (!cacheLoaded) {
        log.error("[AutoUpdate] Timeout loading cached update, flag preserved for retry");
        continueStartup();
      }
    }, 30000);
    
    try {
      await autoUpdater.checkForUpdates();
      
      // Wait a tick for event handler to fire
      await new Promise(resolve => setImmediate(resolve));
      
      if (!cacheLoaded) {
        clearTimeout(installTimeout);
        log.error("[AutoUpdate] checkForUpdates did not load cached update, flag preserved");
        continueStartup();
        return;
      }
      
      clearTimeout(installTimeout);
      log.info("[AutoUpdate] Dispatching update install...");
      
      try {
        autoUpdater.quitAndInstall(true, true);
        log.info("[AutoUpdate] Update install dispatched successfully");
        updateStore.set("updateState", { hasPendingUpdate: false });
        // App will restart - this code won't execute
      } catch (installError) {
        log.error("[AutoUpdate] Install failed (quitAndInstall threw error), flag preserved for retry:", installError);
        continueStartup();
      }
    } catch (error) {
      clearTimeout(installTimeout);
      autoUpdater.off("update-downloaded", cacheLoadHandler);
      log.error("[AutoUpdate] Failed to load/install cached update:", error);
      log.info("[AutoUpdate] Flag preserved for next startup retry");
      continueStartup();
    }
    return;
  }
  
  continueStartup();
});

function continueStartup(): void {
  // Enable auto-launch by default for new users
  if (!autoLaunchManager.hasConfigured()) {
    autoLaunchManager.enable();
    autoLaunchManager.markConfigured();
  }

  // Version comparison for update notification
  try {
    const currentVersion = app.getVersion();
    const lastLaunchedVersion = updateStore.get('lastLaunchedVersion') as string | undefined;
    
    if (lastLaunchedVersion && lastLaunchedVersion !== currentVersion) {
      updateStore.set('shouldShowUpdateToast', true);
    }
    
    updateStore.set('lastLaunchedVersion', currentVersion);
  } catch (error) {
    log.error('[Startup] Failed to check version update:', error);
  }

  createTray();

  // Only create window if not auto-started (tray-only mode)
  if (!isAutoStarted) {
    createWindow();
  }
  
  setMainWindow(win);
  setUpdaterState(updaterState);
  scheduleBackgroundUpdateCheck();

  // =============================================================================
  // Register IPC Handlers
  // =============================================================================
  registerVidyeetHandlers();
  registerClipboardHandlers();
  registerShellHandlers();
  registerWindowHandlers(() => win);
  registerAppHandlers();
  registerTemplateHandlers();
  registerUpdaterHandlers(
    clearBackgroundUpdateCheckTimer,
    runUpdateCheck,
  );
  registerAutoLaunchHandlers();
}

