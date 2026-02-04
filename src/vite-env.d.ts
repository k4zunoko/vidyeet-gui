/// <reference types="vite/client" />

import type { IpcRenderer } from 'electron'
import type {
  VidyeetApi,
  WindowApi,
  ClipboardApi,
  ShellApi,
  AppApi,
  UpdaterApi,
} from '../electron/types/ipc'

declare global {
  interface Window {
    ipcRenderer: IpcRenderer
    vidyeet: VidyeetApi
    windowControl: WindowApi
    clipboard: ClipboardApi
    shell: ShellApi
    app: AppApi
    updater: UpdaterApi
  }
}
