/// <reference types="vite/client" />

import type { IpcRenderer } from 'electron'
import type {
  VidyeetApi,
  WindowApi,
  ClipboardApi,
  AppApi,
  UpdaterApi,
} from '../electron/types/ipc'

declare global {
  interface Window {
    ipcRenderer: IpcRenderer
    vidyeet: VidyeetApi
    windowControl: WindowApi
    clipboard: ClipboardApi
    app: AppApi
    updater: UpdaterApi
  }
}
