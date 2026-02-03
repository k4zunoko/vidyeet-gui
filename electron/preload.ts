import { ipcRenderer, contextBridge } from 'electron'
import {
  IpcChannels,
  type VidyeetApi,
  type WindowApi,
  type ClipboardApi,
  type AppApi,
  type UpdaterApi,
  type UpdateStatusPayload,
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
  type GetTemplateRequest,
  type SaveTemplateRequest,
  type DeleteTemplateRequest,
  type ApplyTemplateRequest,
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

  async getTemplates() {
    return await ipcRenderer.invoke(IpcChannels.TEMPLATES_LIST)
  },

  async getTemplate(request: GetTemplateRequest) {
    return await ipcRenderer.invoke(IpcChannels.TEMPLATES_GET, request)
  },

  async saveTemplate(request: SaveTemplateRequest) {
    return await ipcRenderer.invoke(IpcChannels.TEMPLATES_SAVE, request)
  },

  async deleteTemplate(request: DeleteTemplateRequest) {
    return await ipcRenderer.invoke(IpcChannels.TEMPLATES_DELETE, request)
  },

  async applyTemplate(request: ApplyTemplateRequest) {
    return await ipcRenderer.invoke(IpcChannels.TEMPLATES_APPLY, request)
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
// Application Info API
// =============================================================================

/**
 * アプリケーション情報API - window.app として公開
 */
const appApi: AppApi = {
  async getVersion() {
    return await ipcRenderer.invoke('app:getVersion')
  },
}

contextBridge.exposeInMainWorld('app', appApi)

// =============================================================================
// Auto Updater API
// =============================================================================

/**
 * アップデーターAPI - window.updater として公開
 */
const updaterApi: UpdaterApi = {
  async checkForUpdates() {
    return await ipcRenderer.invoke(IpcChannels.UPDATE_CHECK)
  },

  async downloadUpdate() {
    return await ipcRenderer.invoke(IpcChannels.UPDATE_DOWNLOAD)
  },

  async quitAndInstall() {
    return await ipcRenderer.invoke(IpcChannels.UPDATE_INSTALL)
  },

  onStatus(onStatus) {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: UpdateStatusPayload
    ) => {
      onStatus(payload)
    }

    ipcRenderer.on(IpcChannels.UPDATE_STATUS, listener)

    return () => {
      ipcRenderer.off(IpcChannels.UPDATE_STATUS, listener)
    }
  },
}

contextBridge.exposeInMainWorld('updater', updaterApi)

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
 * IPC型定義はelectron/types/ipc.ts、Preload設計はelectron/preload.tsのコメント参照
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
