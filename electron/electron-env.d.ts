/// <reference types="vite-plugin-electron/electron-env" />

import type {
  VidyeetApi,
  WindowApi,
  ClipboardApi,
  AppApi,
  UpdaterApi,
  AutoLaunchApi,
} from './types/ipc'

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  /** Vidyeet 高水準 API */
  vidyeet: VidyeetApi
  /** ウィンドウ操作 API */
  windowControl: WindowApi
  /** クリップボード API */
  clipboard: ClipboardApi
  /** アプリ情報 API */
  app: AppApi
  /** アップデート API */
  updater: UpdaterApi
  /** 自動起動 API */
  autoLaunch: AutoLaunchApi
}
