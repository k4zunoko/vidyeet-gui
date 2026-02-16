/// <reference types="vite/client" />

import type { AutoLaunchApi } from '../electron/types/ipc'

declare global {
  interface Window {
    autoLaunch: AutoLaunchApi
  }
}
