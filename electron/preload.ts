import { ipcRenderer, contextBridge } from 'electron'
import {
  IpcChannels,
  type VidyeetApi,
  type WindowApi,
  type ClipboardApi,
  type ShellApi,
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
  type AutoLaunchApi,
  type AutoLaunchGetResponse,
  type AutoLaunchSetRequest,
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

   async cancelUpload(uploadId: string): Promise<{ success: boolean }> {
     return await ipcRenderer.invoke(IpcChannels.UPLOAD_CANCEL, { uploadId })
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
// Shell API
// =============================================================================

/**
 * シェルAPI - window.shell として公開
 */
const shellApi: ShellApi = {
  async openExternal(url: string): Promise<void> {
    return await ipcRenderer.invoke(IpcChannels.SHELL_OPEN_EXTERNAL, url)
  },
}

contextBridge.exposeInMainWorld('shell', shellApi)

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
  async getUpdateStatus() {
    return await ipcRenderer.invoke(IpcChannels.APP_GET_UPDATE_STATUS)
  },
  async clearUpdateToast() {
    return await ipcRenderer.invoke(IpcChannels.APP_CLEAR_UPDATE_TOAST)
  },
  onWindowHidden(callback: () => void): () => void {
    ipcRenderer.on(IpcChannels.APP_WINDOW_HIDDEN, callback)
    return () => {
      ipcRenderer.off(IpcChannels.APP_WINDOW_HIDDEN, callback)
    }
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
// Auto Launch API
// =============================================================================

/**
 * 自動起動API - window.autoLaunch として公開
 */
const autoLaunchApi: AutoLaunchApi = {
  async getState(): Promise<AutoLaunchGetResponse | IpcError> {
    return await ipcRenderer.invoke(IpcChannels.AUTO_LAUNCH_GET)
  },

  async setState(request: AutoLaunchSetRequest): Promise<{ success: true } | IpcError> {
    return await ipcRenderer.invoke(IpcChannels.AUTO_LAUNCH_SET, request)
  },
}

contextBridge.exposeInMainWorld('autoLaunch', autoLaunchApi)

