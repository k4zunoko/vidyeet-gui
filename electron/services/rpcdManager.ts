import { app } from "electron";
import { spawn } from "child_process";
import type { ChildProcess } from "child_process";
import Store from "electron-store";
import log from "electron-log/main";
import path from "path";
import fs from "fs";

interface RichPresenceStore {
  richPresence: {
    enabled: boolean;
  };
}

/**
 * RpcdManager manages the Discord Rich Presence daemon (rpcd.exe)
 * - Spawns rpcd.exe as a child process
 * - Persists enabled/disabled state in electron-store
 * - Default: enabled (starts on app launch)
 * - Windows-only service
 */
class RpcdManager {
  private childProcess: ChildProcess | null = null;
  private store: Store<RichPresenceStore>;
  private readonly STORE_KEY = "richPresence";
  private readonly DEFAULT_STATE = {
    richPresence: {
      enabled: true,
    },
  };

  constructor() {
    this.store = new Store<RichPresenceStore>({
      defaults: this.DEFAULT_STATE,
    });
  }

  /**
   * Resolve the path to rpcd.exe
   * - Dev: process.cwd()/bin/rpcd.exe
   * - Prod: process.resourcesPath/bin/rpcd.exe
   */
  private resolveRpcdPath(): string {
    const isDev = !app.isPackaged;
    const binDir = isDev
      ? path.join(process.cwd(), "bin")
      : path.join(process.resourcesPath, "bin");
    return path.join(binDir, "rpcd.exe");
  }

  /**
   * Resolve the bin/ directory (needed for cwd in spawn)
   */
  private resolveBinDir(): string {
    const isDev = !app.isPackaged;
    return isDev
      ? path.join(process.cwd(), "bin")
      : path.join(process.resourcesPath, "bin");
  }

  /**
   * Start rpcd.exe as a child process
   * Guards against double-start
   * Sets cwd to bin/ for DLL resolution
   */
  start(): void {
    // Double-start guard
    if (this.childProcess) {
      log.info("[RpcdManager] rpcd already running, skipping start");
      return;
    }

    // Check if enabled
    if (!this.isEnabled()) {
      log.info("[RpcdManager] Rich Presence is disabled, skipping start");
      return;
    }

    const rpcdPath = this.resolveRpcdPath();
    const binDir = this.resolveBinDir();

    // Verify executable exists
    if (!fs.existsSync(rpcdPath)) {
      log.warn(`[RpcdManager] rpcd.exe not found at: ${rpcdPath}`);
      return;
    }

    try {
      log.info(`[RpcdManager] Starting rpcd from: ${rpcdPath}`);
      const child = spawn(
        "rpcd.exe",
        [
          "--app-id",
          "1471026532247011491", // TODO: Replace with actual Discord application ID
          "--large-image",
          "https://raw.githubusercontent.com/k4zunoko/vidyeet-gui/refs/heads/main/public/icon.png",
          "--button",
          "GitHub Release,https://github.com/k4zunoko/vidyeet-gui/releases/latest",
        ],
        {
          cwd: binDir,
          detached: false,
          windowsHide: true,
          stdio: "ignore",
        },
      );

      child.on("exit", (code) => {
        log.info(`[RpcdManager] rpcd exited with code: ${code}`);
        this.childProcess = null;
      });

      child.on("error", (err) => {
        log.error("[RpcdManager] rpcd spawn error:", err);
        this.childProcess = null;
      });

      this.childProcess = child;
      log.info("[RpcdManager] rpcd started successfully");
    } catch (error) {
      log.error("[RpcdManager] Failed to start rpcd:", error);
    }
  }

  /**
   * Stop rpcd.exe
   * Uses child.kill() then taskkill fallback after 500ms if still running
   */
  stop(): void {
    if (!this.childProcess) {
      return;
    }

    const pid = this.childProcess.pid;
    log.info(`[RpcdManager] Stopping rpcd (PID: ${pid})`);

    try {
      this.childProcess.kill();
    } catch (error) {
      log.error("[RpcdManager] kill() failed:", error);
    }

    // Taskkill fallback after 500ms
    if (pid) {
      setTimeout(() => {
        if (this.childProcess !== null) {
          log.warn(
            `[RpcdManager] rpcd still running after kill(), using taskkill /PID ${pid} /T /F`,
          );
          try {
            spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
              windowsHide: true,
              stdio: "ignore",
            });
          } catch (error) {
            log.error("[RpcdManager] taskkill failed:", error);
          }
          this.childProcess = null;
        }
      }, 500);
    } else {
      this.childProcess = null;
    }
  }

  /**
   * Check if Rich Presence is enabled in settings
   */
  isEnabled(): boolean {
    try {
      const enabled = this.store.get(`${this.STORE_KEY}.enabled`);
      return enabled ?? this.DEFAULT_STATE.richPresence.enabled;
    } catch (error) {
      log.error("[RpcdManager] Failed to read enabled state:", error);
      return this.DEFAULT_STATE.richPresence.enabled;
    }
  }

  /**
   * Set enabled state and start/stop rpcd accordingly
   */
  setEnabled(enabled: boolean): void {
    try {
      this.store.set(`${this.STORE_KEY}.enabled`, enabled);
      log.info(
        `[RpcdManager] Rich Presence ${enabled ? "enabled" : "disabled"}`,
      );
      if (enabled) {
        this.start();
      } else {
        this.stop();
      }
    } catch (error) {
      log.error("[RpcdManager] Failed to set enabled state:", error);
    }
  }

  /**
   * Check if rpcd process is currently running
   */
  isRunning(): boolean {
    return this.childProcess !== null && !this.childProcess.killed;
  }
}

// Singleton instance
export const rpcdManager = new RpcdManager();

// Default export
export default rpcdManager;
