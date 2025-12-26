import { ipcRenderer, contextBridge } from 'electron'
import {
  IpcChannels,
  type VidyeetApi,
  type WindowApi,
  type ClipboardApi,
  type LoginRequest,
  type DeleteRequest,
  type UploadRequest,
  type StatusResponse,
  type LoginResponse,
  type LogoutResponse,
  type ListResponse,
  type DeleteResponse,
  type SelectFileResponse,
  type UploadResponse,
  type UploadProgress,
  type IpcError,
} from './types/ipc'

// =============================================================================
// Vidyeet API (High-level)
// =============================================================================

/**
 * 高水準API - window.vidyeet として公開
 * Renderer は IPC チャネル名を知らずに済む
 */
const vidyeetApi: VidyeetApi = {
  async status(): Promise<StatusResponse | IpcError> {
    return await ipcRenderer.invoke(IpcChannels.STATUS)
  },

  async login(request: LoginRequest): Promise<LoginResponse | IpcError> {
    return await ipcRenderer.invoke(IpcChannels.LOGIN, request)
  },

  async logout(): Promise<LogoutResponse | IpcError> {
    return await ipcRenderer.invoke(IpcChannels.LOGOUT)
  },

  async list(): Promise<ListResponse | IpcError> {
    return await ipcRenderer.invoke(IpcChannels.LIST)
  },

  async delete(request: DeleteRequest): Promise<DeleteResponse | IpcError> {
    return await ipcRenderer.invoke(IpcChannels.DELETE, request)
  },

  async selectFile(): Promise<SelectFileResponse | IpcError> {
    return await ipcRenderer.invoke(IpcChannels.SELECT_FILE)
  },

  async upload(
    request: UploadRequest,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResponse | IpcError> {
    // 進捗リスナーを登録
    const progressListener = (_event: Electron.IpcRendererEvent, progress: UploadProgress) => {
      onProgress?.(progress)
    }
    
    if (onProgress) {
      ipcRenderer.on('vidyeet:uploadProgress', progressListener)
    }

    try {
      return await ipcRenderer.invoke(IpcChannels.UPLOAD, request)
    } finally {
      // リスナーをクリーンアップ
      if (onProgress) {
        ipcRenderer.off('vidyeet:uploadProgress', progressListener)
      }
    }
  },
}

contextBridge.exposeInMainWorld('vidyeet', vidyeetApi)

// =============================================================================
// Clipboard API
// =============================================================================

/**
 * クリップボードAPI - window.clipboard として公開
 */
const clipboardApi: ClipboardApi = {
  async writeText(text: string): Promise<void> {
    return await ipcRenderer.invoke(IpcChannels.CLIPBOARD_WRITE, text)
  },
}

contextBridge.exposeInMainWorld('clipboard', clipboardApi)

// =============================================================================
// Window Control API
// =============================================================================

/**
 * ウィンドウ操作API - window.windowControl として公開
 * フレームレスウィンドウの操作用
 */
const windowApi: WindowApi = {
  async minimize(): Promise<void> {
    return await ipcRenderer.invoke('window:minimize')
  },

  async maximize(): Promise<void> {
    return await ipcRenderer.invoke('window:maximize')
  },

  async close(): Promise<void> {
    return await ipcRenderer.invoke('window:close')
  },

  async isMaximized(): Promise<boolean> {
    return await ipcRenderer.invoke('window:isMaximized')
  },
}

contextBridge.exposeInMainWorld('windowControl', windowApi)

// =============================================================================
// Legacy ipcRenderer API (for backward compatibility)
// =============================================================================

/**
 * @deprecated 後方互換のために残しているが、新規コードでは使用禁止
 *
 * Renderer は高水準API（window.vidyeet）を使用すること。
 * この API は段階的に廃止予定：
 * 1. 新規機能では window.vidyeet のみ使用
 * 2. 既存の window.ipcRenderer 使用箇所を window.vidyeet に移行
 * 3. 移行完了後、この公開を削除
 *
 * @see docs/ARCHITECTURE.md - Preload の責務
 * @see docs/IPC_CONTRACT.md - 原則
 */
// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})
