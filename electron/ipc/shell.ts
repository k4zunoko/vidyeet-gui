/**
 * Shell IPC Handlers
 *
 * 外部URLを開くなど、シェル操作のIPCハンドラー
 */
import { ipcMain, shell } from "electron";
import { IpcChannels } from "../types/ipc";

/**
 * Shell関連のIPCハンドラーを登録
 */
export function registerShellHandlers(): void {
  ipcMain.handle(IpcChannels.SHELL_OPEN_EXTERNAL, async (_event, url: string) => {
    await shell.openExternal(url);
  });
}
