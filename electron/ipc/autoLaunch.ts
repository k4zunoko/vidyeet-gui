/**
 * Auto Launch IPC Handler
 *
 * Handles: autoLaunch:get, autoLaunch:set
 */

import { ipcMain } from "electron";
import { IpcChannels } from "../types/ipc";
import autoLaunchManager from "../services/autoLaunchManager";
import type { IpcError, AutoLaunchGetResponse, AutoLaunchSetRequest, AutoLaunchSetResponse } from "../types/ipc";

export function registerAutoLaunchHandlers(): void {
  /**
   * autoLaunch:get - Get current auto-launch state
   */
  ipcMain.handle(IpcChannels.AUTO_LAUNCH_GET, async (): Promise<AutoLaunchGetResponse | IpcError> => {
    try {
      const enabled = autoLaunchManager.isEnabled();
      return { enabled };
    } catch (error) {
      return formatAutoLaunchError(error);
    }
  });

  /**
   * autoLaunch:set - Set auto-launch state
   */
  ipcMain.handle(
    IpcChannels.AUTO_LAUNCH_SET,
    async (_, request: AutoLaunchSetRequest): Promise<AutoLaunchSetResponse | IpcError> => {
      try {
        const result = request.enabled ? autoLaunchManager.enable() : autoLaunchManager.disable();

        if (!result) {
          return {
            code: "AUTO_LAUNCH_ERROR",
            message: `Failed to ${request.enabled ? "enable" : "disable"} auto-launch`,
          };
        }

        return { success: true };
      } catch (error) {
        return formatAutoLaunchError(error);
      }
    },
  );
}

/**
 * Format error to IpcError format
 */
function formatAutoLaunchError(error: unknown): IpcError {
  if (error instanceof Error) {
    return {
      code: "AUTO_LAUNCH_ERROR",
      message: error.message,
      details: error.stack,
    };
  }

  return {
    code: "AUTO_LAUNCH_ERROR",
    message: String(error ?? "Unknown error"),
  };
}
