/** i18n instance configuration with persistence */
import { createI18n } from 'vue-i18n';
import type { MessageSchema, SupportedLocale } from './types';
import jaMessages from './locales/ja.json';
import enMessages from './locales/en.json';

const STORAGE_KEY = 'vidyeet-language';

function getInitialLocale(): SupportedLocale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'ja' || stored === 'en') {
    return stored;
  }
  return 'ja'; // Default to Japanese
}

export function saveLocale(locale: SupportedLocale): void {
  localStorage.setItem(STORAGE_KEY, locale);
}

export const i18n = createI18n<[MessageSchema], SupportedLocale>({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'ja',
  messages: {
    ja: jaMessages,
    en: enMessages,
  },
});

export type { MessageSchema, SupportedLocale };
