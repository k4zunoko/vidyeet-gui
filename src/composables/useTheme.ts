/** Theme management with persistence and system theme detection */
import { ref, computed, onMounted, onUnmounted } from 'vue';

export type ThemeOption = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'vidyeet-theme';

function getInitialTheme(): ThemeOption {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'dark';
}

function resolveEffectiveTheme(option: ThemeOption): 'light' | 'dark' {
  if (option === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return option;
}

function applyTheme(effectiveTheme: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', effectiveTheme);
  document.documentElement.style.colorScheme = effectiveTheme;
}

export function useTheme() {
  const currentTheme = ref<ThemeOption>(getInitialTheme());

  const effectiveTheme = computed(() => resolveEffectiveTheme(currentTheme.value));

  const setTheme = (option: ThemeOption): void => {
    currentTheme.value = option;
    localStorage.setItem(STORAGE_KEY, option);
    applyTheme(resolveEffectiveTheme(option));
  };

  let mediaQuery: MediaQueryList | null = null;

  const handleSystemThemeChange = (): void => {
    if (currentTheme.value === 'system') {
      applyTheme(resolveEffectiveTheme('system'));
    }
  };

  onMounted(() => {
    applyTheme(resolveEffectiveTheme(currentTheme.value));
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleSystemThemeChange);
  });

  onUnmounted(() => {
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }
  });

  return {
    currentTheme,
    effectiveTheme,
    setTheme,
  };
}
