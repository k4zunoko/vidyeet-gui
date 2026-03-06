/**
 * Rich Presence IPC Handler
 *
 * Handles: richPresence:get, richPresence:set
 */

import { ipcMain } from "electron";
import { IpcChannels } from "../types/ipc";
import { rpcdManager } from "../services/rpcdManager";
import type { IpcError, RichPresenceGetResponse, RichPresenceSetRequest, RichPresenceSetResponse } from "../types/ipc";

export function registerRichPresenceHandlers(): void {
  /**
   * richPresence:get - Get current rich presence state
   */
  ipcMain.handle(IpcChannels.RICH_PRESENCE_GET, async (): Promise<RichPresenceGetResponse | IpcError> => {
    try {
      const enabled = rpcdManager.isEnabled();
      return { enabled };
    } catch (error) {
      return formatRichPresenceError(error);
    }
  });

  /**
   * richPresence:set - Set rich presence state
   */
  ipcMain.handle(
    IpcChannels.RICH_PRESENCE_SET,
    async (_, request: RichPresenceSetRequest): Promise<RichPresenceSetResponse | IpcError> => {
      try {
        rpcdManager.setEnabled(request.enabled);
        return { success: true };
      } catch (error) {
        return formatRichPresenceError(error);
      }
    },
  );
}

/**
 * Format error to IpcError format
 */
function formatRichPresenceError(error: unknown): IpcError {
  if (error instanceof Error) {
    return {
      code: "RICH_PRESENCE_ERROR",
      message: error.message,
      details: error.stack,
    };
  }

  return {
    code: "RICH_PRESENCE_ERROR",
    message: String(error ?? "Unknown error"),
  };
}
