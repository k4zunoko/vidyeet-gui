/**
 * Window Control IPC Handlers
 *
 * Handles: window:minimize, window:maximize, window:close, window:isMaximized
 */

import { ipcMain, BrowserWindow } from "electron";

export function registerWindowHandlers(
  getWindow: () => BrowserWindow | null,
): void {
  /**
   * window:minimize - ウィンドウを最小化
   */
  ipcMain.handle("window:minimize", () => {
    getWindow()?.minimize();
  });

  /**
   * window:maximize - ウィンドウを最大化/元に戻す
   */
  ipcMain.handle("window:maximize", () => {
    const win = getWindow();
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
    getWindow()?.close();
  });

  /**
   * window:isMaximized - 最大化状態を取得
   */
  ipcMain.handle("window:isMaximized", () => {
    return getWindow()?.isMaximized() ?? false;
  });
}
