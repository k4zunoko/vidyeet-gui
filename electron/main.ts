import { app, BrowserWindow } from "electron";
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
import {
  registerUpdaterHandlers,
  setMainWindow,
  setUpdaterState,
} from "./ipc/updater";

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
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  setupAutoUpdater();
  createWindow();
  setMainWindow(win);
  setUpdaterState(updaterState);
  scheduleBackgroundUpdateCheck();

  // =============================================================================
  // Register IPC Handlers
  // =============================================================================
  registerVidyeetHandlers();
  registerClipboardHandlers();
  registerWindowHandlers(() => win);
  registerAppHandlers();
  registerUpdaterHandlers(
    clearBackgroundUpdateCheckTimer,
    runUpdateCheck,
  );
});

