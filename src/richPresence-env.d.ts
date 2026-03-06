/// <reference types="vite/client" />

import type { RichPresenceApi } from '../electron/types/ipc'

declare global {
  interface Window {
    richPresence: RichPresenceApi
  }
}
