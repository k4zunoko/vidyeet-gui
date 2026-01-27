import { app, BrowserWindow, ipcMain, clipboard } from "electron";
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
  type LoginRequest,
  type DeleteRequest,
  type UploadRequest,
  type UploadProgress,
} from "./types/ipc";
import {
  getStatus,
  login,
  logout,
  getList,
  deleteAsset,
  selectFile,
  upload,
} from "./services/vidyeetClient";

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

function sendUpdateStatus(payload: UpdateStatusPayload) {
  win?.webContents.send(IpcChannels.UPDATE_STATUS, payload);
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.logger = log;
  log.transports.file.level = "info";

  autoUpdater.on("checking-for-update", () => {
    sendUpdateStatus({ status: "checking-for-update" });
  });

  autoUpdater.on("update-available", (info: UpdateInfo) => {
    sendUpdateStatus({ status: "update-available", info });
  });

  autoUpdater.on("update-not-available", (info: UpdateInfo) => {
    sendUpdateStatus({ status: "update-not-available", info });
  });

  autoUpdater.on(
    "download-progress",
    (progress: ProgressInfo) => {
      sendUpdateStatus({
        status: "download-progress",
        progress: {
          percent: progress.percent,
          transferred: progress.transferred,
          total: progress.total,
          bytesPerSecond: progress.bytesPerSecond,
        },
      });
    }
  );

  autoUpdater.on("update-downloaded", (info: UpdateDownloadedEvent) => {
    sendUpdateStatus({ status: "update-downloaded", info });
  });

  autoUpdater.on("error", (error: unknown) => {
    const details = normalizeAutoUpdateErrorDetails(error);
    const resolved = resolveAutoUpdateError(details, "更新の処理に失敗しました。ネットワークを確認して再試行してください。");
    log.error("autoUpdater error", error);
    sendUpdateStatus({ status: "error", error: resolved.message });
  });
}

function createWindow() {
  // アプリケーション名を設定
  app.name = "Vidyeet";

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
});

// =============================================================================
// IPC Handlers
// =============================================================================

/**
 * vidyeet:status - 認証状態を取得
 */
ipcMain.handle(IpcChannels.STATUS, async () => {
  return await getStatus();
});

/**
 * vidyeet:login - ログイン
 */
ipcMain.handle(IpcChannels.LOGIN, async (_event, request: LoginRequest) => {
  return await login(request);
});

/**
 * vidyeet:logout - ログアウト
 */
ipcMain.handle(IpcChannels.LOGOUT, async () => {
  return await logout();
});

/**
 * vidyeet:list - アセット一覧を取得
 */
ipcMain.handle(IpcChannels.LIST, async () => {
  return await getList();
});

/**
 * vidyeet:delete - アセットを削除
 */
ipcMain.handle(IpcChannels.DELETE, async (_event, request: DeleteRequest) => {
  return await deleteAsset(request);
});

/**
 * vidyeet:selectFile - ファイル選択ダイアログを表示
 */
ipcMain.handle(IpcChannels.SELECT_FILE, async () => {
  return await selectFile();
});

/**
 * vidyeet:upload - 動画をアップロード
 * 進捗はイベントでRendererに送信
 */
ipcMain.handle(IpcChannels.UPLOAD, async (event, request: UploadRequest) => {
  return await upload(request, (progress: UploadProgress) => {
    // 進捗をRendererに送信
    event.sender.send("vidyeet:uploadProgress", progress);
  });
});

/**
 * clipboard:write - クリップボードにテキストを書き込み
 */
ipcMain.handle(IpcChannels.CLIPBOARD_WRITE, (_event, text: string) => {
  clipboard.writeText(text);
});

// =============================================================================
// Window Control IPC Handlers
// =============================================================================

/**
 * window:minimize - ウィンドウを最小化
 */
ipcMain.handle("window:minimize", () => {
  win?.minimize();
});

/**
 * window:maximize - ウィンドウを最大化/元に戻す
 */
ipcMain.handle("window:maximize", () => {
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});

/**
 * window:close - ウィンドウを閉じる
 */
ipcMain.handle("window:close", () => {
  win?.close();
});

/**
 * window:isMaximized - 最大化状態を取得
 */
ipcMain.handle("window:isMaximized", () => {
  return win?.isMaximized() ?? false;
});

// =============================================================================
// Application Info IPC Handler
// =============================================================================

/**
 * app:getVersion - アプリケーションのバージョンと情報を取得
 */
ipcMain.handle("app:getVersion", () => {
  return {
    version: app.getVersion(),
    appName: "Vidyeet",
    description: "Safe and Convenient Video Uploading and Management.",
    author: "Vidyeet Team",
    license: "MIT",
    repository: "https://github.com/k4zunoko/vidyeet-gui",
  };
});

// =============================================================================
// Auto Updater IPC Handlers
// =============================================================================

function normalizeAutoUpdateErrorDetails(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resolveAutoUpdateError(
  details: string,
  fallbackMessage: string
): Pick<IpcError, "code" | "message"> {
  const normalized = details.toLowerCase();

  if (normalized.includes("app-update.yml") && normalized.includes("enoent")) {
    return {
      code: "AUTO_UPDATE_CONFIG_MISSING",
      message: "更新情報が見つかりませんでした。インストール済みのアプリから実行してください。",
    };
  }

  if (
    normalized.includes("unable to find latest version on github") ||
    normalized.includes("cannot parse releases feed") ||
    normalized.includes("releases/latest")
  ) {
    return {
      code: "AUTO_UPDATE_RELEASE_NOT_FOUND",
      message: "最新のリリースが公開されていないため、更新を確認できません。公開後に再試行してください。",
    };
  }

  return {
    code: "AUTO_UPDATE_ERROR",
    message: fallbackMessage,
  };
}

function buildAutoUpdateError(error: unknown, fallbackMessage: string): IpcError {
  const details = normalizeAutoUpdateErrorDetails(error);
  const resolved = resolveAutoUpdateError(details, fallbackMessage);

  return {
    code: resolved.code,
    message: resolved.message,
    details,
  };
}

function buildAutoUpdateDisabledError(): IpcError {
  return {
    code: "AUTO_UPDATE_DISABLED",
    message: "Auto update is only available in packaged builds.",
  };
}

ipcMain.handle(IpcChannels.UPDATE_CHECK, async () => {
  if (!app.isPackaged) {
    return buildAutoUpdateDisabledError();
  }

  try {
    await autoUpdater.checkForUpdates();
    return { success: true };
  } catch (error) {
    log.error("autoUpdater checkForUpdates failed", error);
    return buildAutoUpdateError(
      error,
      "更新の確認に失敗しました。ネットワークを確認して再試行してください。"
    );
  }
});

ipcMain.handle(IpcChannels.UPDATE_DOWNLOAD, async () => {
  if (!app.isPackaged) {
    return buildAutoUpdateDisabledError();
  }

  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    log.error("autoUpdater downloadUpdate failed", error);
    return buildAutoUpdateError(
      error,
      "更新のダウンロードに失敗しました。ネットワークを確認して再試行してください。"
    );
  }
});

ipcMain.handle(IpcChannels.UPDATE_INSTALL, () => {
  if (!app.isPackaged) {
    return buildAutoUpdateDisabledError();
  }

  autoUpdater.quitAndInstall();
  return { success: true };
});
