import { app } from 'electron';
import Store from 'electron-store';
import log from 'electron-log/main';

interface AutoLaunchStore {
  autoLaunch: {
    enabled: boolean;
    hasShownFirstRunNotification: boolean;
  };
}

/**
 * AutoLaunchManager handles Windows auto-launch configuration
 * - Manages Windows auto-start at login via app.setLoginItemSettings
 * - Persists user preferences in electron-store
 * - Detects if app was launched with --hidden flag (tray startup)
 * - Windows-only service (no cross-platform support)
 */
class AutoLaunchManager {
  private store: Store<AutoLaunchStore>;
  private readonly STORE_KEY = 'autoLaunch';
  private readonly DEFAULT_STATE = {
    autoLaunch: {
      enabled: true, // Default: enabled on first install
      hasShownFirstRunNotification: false,
    },
  };

  constructor() {
    this.store = new Store<AutoLaunchStore>({
      defaults: this.DEFAULT_STATE,
    });
  }

  /**
   * Check if app was launched with --hidden flag (tray startup)
   * @returns true if app was started from auto-launch (hidden)
   */
  isAutoStarted(): boolean {
    return process.argv.includes('--hidden');
  }

  /**
   * Enable auto-launch on Windows
   * Sets app to launch at login with --hidden flag for tray-only startup
   * @returns true if enabled successfully
   */
  enable(): boolean {
    try {
      // Only run on Windows
      if (process.platform !== 'win32') {
        log.warn('[AutoLaunch] enable() called on non-Windows platform, skipping');
        return false;
      }

      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true,
        args: ['--hidden'],
      });

      // Persist preference
      this.store.set(`${this.STORE_KEY}.enabled`, true);
      log.info('[AutoLaunch] Auto-launch enabled');
      return true;
    } catch (error) {
      log.error('[AutoLaunch] Failed to enable auto-launch:', error);
      return false;
    }
  }

  /**
   * Disable auto-launch on Windows
   * @returns true if disabled successfully
   */
  disable(): boolean {
    try {
      // Only run on Windows
      if (process.platform !== 'win32') {
        log.warn('[AutoLaunch] disable() called on non-Windows platform, skipping');
        return false;
      }

      app.setLoginItemSettings({
        openAtLogin: false,
      });

      // Persist preference
      this.store.set(`${this.STORE_KEY}.enabled`, false);
      log.info('[AutoLaunch] Auto-launch disabled');
      return true;
    } catch (error) {
      log.error('[AutoLaunch] Failed to disable auto-launch:', error);
      return false;
    }
  }

  /**
   * Check if auto-launch is currently enabled
   * Returns the stored preference value
   * @returns true if auto-launch is enabled
   */
  isEnabled(): boolean {
    try {
      const enabled = this.store.get(`${this.STORE_KEY}.enabled`);
      return enabled ?? this.DEFAULT_STATE.autoLaunch.enabled;
    } catch (error) {
      log.error('[AutoLaunch] Failed to check auto-launch status:', error);
      return this.DEFAULT_STATE.autoLaunch.enabled;
    }
  }

  /**
   * Check if first-run notification has been shown to user
   * @returns true if notification was already shown
   */
  hasShownFirstRunNotification(): boolean {
    try {
      const shown = this.store.get(`${this.STORE_KEY}.hasShownFirstRunNotification`);
      return shown ?? false;
    } catch (error) {
      log.error('[AutoLaunch] Failed to check first-run notification status:', error);
      return false;
    }
  }

  /**
   * Mark first-run notification as shown
   * @returns true if set successfully
   */
  setFirstRunNotificationShown(): boolean {
    try {
      this.store.set(`${this.STORE_KEY}.hasShownFirstRunNotification`, true);
      log.info('[AutoLaunch] First-run notification marked as shown');
      return true;
    } catch (error) {
      log.error('[AutoLaunch] Failed to set first-run notification shown:', error);
      return false;
    }
  }

  /**
   * Get current auto-launch settings from Windows registry
   * Returns the system-level settings from app.getLoginItemSettings()
   * @returns Windows login item settings
   */
  getSystemSettings(): ReturnType<typeof app.getLoginItemSettings> {
    try {
      if (process.platform !== 'win32') {
        log.warn('[AutoLaunch] getSystemSettings() called on non-Windows platform');
        return app.getLoginItemSettings();
      }

      return app.getLoginItemSettings();
    } catch (error) {
      log.error('[AutoLaunch] Failed to get system settings:', error);
      return app.getLoginItemSettings();
    }
  }

  /**
   * Reset auto-launch settings to defaults
   * Useful for debugging or factory reset
   * @returns true if reset successfully
   */
  reset(): boolean {
    try {
      this.store.set(this.STORE_KEY, this.DEFAULT_STATE.autoLaunch);
      this.disable(); // Also disable in Windows
      log.info('[AutoLaunch] Settings reset to defaults');
      return true;
    } catch (error) {
      log.error('[AutoLaunch] Failed to reset auto-launch settings:', error);
      return false;
    }
  }
}

// Singleton instance
export const autoLaunchManager = new AutoLaunchManager();

// Default export
export default autoLaunchManager;
