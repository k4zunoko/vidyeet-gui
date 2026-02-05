/**
 * Vidyeet IPC Handlers
 *
 * Handles: STATUS, LOGIN, LOGOUT, LIST, DELETE, SELECT_FILE, UPLOAD
 */

import { ipcMain } from "electron";
import {
  IpcChannels,
  type LoginRequest,
  type DeleteRequest,
  type UploadRequest,
  type UploadProgress,
} from "../types/ipc";
import {
  getStatus,
  login,
  logout,
  getList,
  deleteAsset,
  selectFile,
  upload,
  cancelUpload,
} from "../services/vidyeetClient";

export function registerVidyeetHandlers(): void {
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
   * vidyeet:upload:cancel - Cancel active upload
   */
  ipcMain.handle(IpcChannels.UPLOAD_CANCEL, async (_event, payload: { uploadId: string }) => {
    const success = cancelUpload(payload.uploadId);
    return { success };
  });
}
