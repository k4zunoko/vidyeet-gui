/**
 * Auto Updater IPC Handlers
 *
 * Handles: UPDATE_CHECK, UPDATE_DOWNLOAD, UPDATE_INSTALL
 */

import { ipcMain, app, BrowserWindow } from "electron";
import { autoUpdater, type ProgressInfo } from "electron-updater";
import log from "electron-log/main";
import {
  IpcChannels,
  type IpcError,
  type UpdateStatusPayload,
} from "../types/ipc";

// State object (will be set by main.ts)
interface UpdaterState {
  updateCheckInProgress: boolean;
  updateDownloadInProgress: boolean;
  updateDownloadedInfo: any;
  currentCheckTrigger: "manual" | "background" | null;
  currentDownloadTrigger: "manual" | "background" | null;
  lastDownloadProgress: ProgressInfo | null;
}

let state: UpdaterState | null = null;
let mainWindow: BrowserWindow | null = null;

export function setUpdaterState(updaterState: UpdaterState): void {
  state = updaterState;
}

export function setMainWindow(window: BrowserWindow | null): void {
  mainWindow = window;
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

function buildAutoUpdateError(
  error: unknown,
  fallbackMessage: string,
): IpcError {
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

function buildUpdateProgress(progress: ProgressInfo) {
  return {
    percent: progress.percent,
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond,
  };
}

function sendUpdateStatus(payload: UpdateStatusPayload) {
  mainWindow?.webContents.send(IpcChannels.UPDATE_STATUS, payload);
}

export function registerUpdaterHandlers(
  clearBackgroundUpdateCheckTimer: () => void,
  runUpdateCheck: (trigger: "manual" | "background") => Promise<void>,
): void {
  ipcMain.handle(IpcChannels.UPDATE_CHECK, async () => {
    if (!state) {
      return buildAutoUpdateDisabledError();
    }

    if (!app.isPackaged) {
      return buildAutoUpdateDisabledError();
    }

    clearBackgroundUpdateCheckTimer();

    if (state.updateDownloadedInfo) {
      sendUpdateStatus({
        status: "update-downloaded",
        info: state.updateDownloadedInfo,
      });
      return { success: true };
    }

    if (state.updateDownloadInProgress) {
      state.currentDownloadTrigger = "manual";

      if (state.lastDownloadProgress) {
        sendUpdateStatus({
          status: "download-progress",
          progress: buildUpdateProgress(state.lastDownloadProgress),
        });
      } else {
        sendUpdateStatus({ status: "download-progress" });
      }

      return { success: true };
    }

    try {
      await runUpdateCheck("manual");
      return { success: true };
    } catch (error) {
      log.error("autoUpdater checkForUpdates failed", error);
      return buildAutoUpdateError(
        error,
        "更新の確認に失敗しました。ネットワークを確認して再試行してください。",
      );
    }
  });

  ipcMain.handle(IpcChannels.UPDATE_DOWNLOAD, async () => {
    if (!state) {
      return buildAutoUpdateDisabledError();
    }

    if (!app.isPackaged) {
      return buildAutoUpdateDisabledError();
    }

    clearBackgroundUpdateCheckTimer();

    if (state.updateDownloadedInfo) {
      sendUpdateStatus({
        status: "update-downloaded",
        info: state.updateDownloadedInfo,
      });
      return { success: true };
    }

    if (state.updateDownloadInProgress) {
      state.currentDownloadTrigger = "manual";

      if (state.lastDownloadProgress) {
        sendUpdateStatus({
          status: "download-progress",
          progress: buildUpdateProgress(state.lastDownloadProgress),
        });
      } else {
        sendUpdateStatus({ status: "download-progress" });
      }

      return { success: true };
    }

    state.currentDownloadTrigger = "manual";
    state.updateDownloadInProgress = true;

    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      state.updateDownloadInProgress = false;
      state.currentDownloadTrigger = null;
      log.error("autoUpdater downloadUpdate failed", error);
      return buildAutoUpdateError(
        error,
        "更新のダウンロードに失敗しました。ネットワークを確認して再試行してください。",
      );
    }
  });

  ipcMain.handle(IpcChannels.UPDATE_INSTALL, () => {
    if (!app.isPackaged) {
      return buildAutoUpdateDisabledError();
    }

    autoUpdater.quitAndInstall(true, true);
    return { success: true };
  });
}
