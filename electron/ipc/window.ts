/**
 * Window Control IPC Handlers
 *
 * Handles: window:minimize, window:maximize, window:close, window:isMaximized
 */

import { ipcMain, BrowserWindow } from "electron";
import { IpcChannels } from "../types/ipc";

export function registerWindowHandlers(
  getWindow: () => BrowserWindow | null,
): void {
  /**
   * window:minimize - ウィンドウを最小化
   */
  ipcMain.handle(IpcChannels.WINDOW_MINIMIZE, () => {
    getWindow()?.minimize();
  });

  /**
   * window:maximize - ウィンドウを最大化/元に戻す
   */
  ipcMain.handle(IpcChannels.WINDOW_MAXIMIZE, () => {
    const win = getWindow();
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });

  /**
   * window:close - ウィンドウを閉じる（タスクトレイに格納）
   */
  ipcMain.handle(IpcChannels.WINDOW_CLOSE, () => {
    getWindow()?.hide();
  });

  /**
   * window:isMaximized - 最大化状態を取得
   */
  ipcMain.handle(IpcChannels.WINDOW_IS_MAXIMIZED, () => {
    return getWindow()?.isMaximized() ?? false;
  });
}
