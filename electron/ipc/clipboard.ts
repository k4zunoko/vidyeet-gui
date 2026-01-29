/**
 * Clipboard IPC Handlers
 *
 * Handles: clipboard:write
 */

import { ipcMain, clipboard } from "electron";
import { IpcChannels } from "../types/ipc";

export function registerClipboardHandlers(): void {
  /**
   * clipboard:write - クリップボードにテキストを書き込み
   */
  ipcMain.handle(IpcChannels.CLIPBOARD_WRITE, (_event, text: string) => {
    clipboard.writeText(text);
  });
}
