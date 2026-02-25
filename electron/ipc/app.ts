/**
 * Application Info IPC Handler
 *
 * Handles: app:getVersion, app:getUpdateStatus, app:clearUpdateToast
 */

import { ipcMain, app } from "electron";
import { IpcChannels } from "../types/ipc";
import { updateStore } from "../main";
import log from "electron-log";

export function registerAppHandlers(): void {
  /**
   * app:getVersion - アプリケーションのバージョンと情報を取得
   */
  ipcMain.handle(IpcChannels.APP_GET_VERSION, () => {
    return {
      version: app.getVersion(),
      appName: "Vidyeet",
      description: "Safe and Convenient Video Uploading and Management.",
      author: "Vidyeet Team",
      license: "MIT",
      repository: "https://github.com/k4zunoko/vidyeet-gui",
    };
  });

  /**
   * app:getUpdateStatus - アップデート通知フラグを取得
   */
  ipcMain.handle(IpcChannels.APP_GET_UPDATE_STATUS, () => {
    try {
      const shouldShow = updateStore.get('shouldShowUpdateToast') as boolean | undefined;
      return { shouldShowUpdateToast: shouldShow ?? false };
    } catch (error) {
      log.error('[App] Failed to get update status:', error);
      return { shouldShowUpdateToast: false };
    }
  });

  /**
   * app:clearUpdateToast - アップデート通知フラグをクリア
   */
  ipcMain.handle(IpcChannels.APP_CLEAR_UPDATE_TOAST, () => {
    try {
      updateStore.set('shouldShowUpdateToast', false);
      return { success: true as const };
    } catch (error) {
      log.error('[App] Failed to clear update toast flag:', error);
      return { success: true as const }; // Always return success to prevent retry loops
    }
  });
}
