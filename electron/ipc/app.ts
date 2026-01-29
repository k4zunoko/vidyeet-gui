/**
 * Application Info IPC Handler
 *
 * Handles: app:getVersion
 */

import { ipcMain, app } from "electron";

export function registerAppHandlers(): void {
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
}
