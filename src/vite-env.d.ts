/// <reference types="vite/client" />

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
    vidyeet: VidyeetApi
    windowControl: WindowApi
    clipboard: ClipboardApi
    shell: ShellApi
    app: AppApi
    updater: UpdaterApi
  }
}
