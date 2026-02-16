/** Auto-launch management composable */
import { ref, computed } from 'vue';
import { isIpcError } from '../../electron/types/ipc';

export function useAutoLaunch() {
  const enabled = ref<boolean>(false);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);
  const previousState = ref<boolean>(false);

  /**
   * Load auto-launch state from system
   * Sets error message if loading fails
   */
  const loadState = async (): Promise<void> => {
    isLoading.value = true;
    error.value = null;

    try {
      const result = await window.autoLaunch.getState();

      if (isIpcError(result)) {
        error.value = result.message;
        return;
      }

      enabled.value = result.enabled;
      previousState.value = result.enabled;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Set auto-launch state
   * Reverts toggle to previous state if operation fails
   * @param value - true to enable, false to disable
   */
  const setAutoLaunch = async (value: boolean): Promise<void> => {
    // Save current state for potential revert
    const previousValue = enabled.value;
    isLoading.value = true;
    error.value = null;

    try {
      // Optimistically update UI
      enabled.value = value;

      const result = await window.autoLaunch.setState({ enabled: value });

      if (isIpcError(result)) {
        // Operation failed: revert toggle and show error
        enabled.value = previousValue;
        error.value = result.message || 'Failed to update auto-launch setting';
        return;
      }

      // Success: keep the new state
      previousState.value = value;
    } catch (err) {
      // Network/unexpected error: revert toggle
      enabled.value = previousValue;
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      isLoading.value = false;
    }
  };

  const hasError = computed(() => error.value !== null);

  return {
    enabled,
    isLoading,
    error,
    hasError,
    loadState,
    setAutoLaunch,
  };
}
