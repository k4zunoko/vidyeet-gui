/** Language switching with persistence */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { SupportedLocale } from '../i18n';
import { saveLocale } from '../i18n';

export function useLanguage() {
  const { locale } = useI18n();
  
  const currentLanguage = computed<SupportedLocale>({
    get: () => locale.value as SupportedLocale,
    set: (value: SupportedLocale) => {
      locale.value = value;
      saveLocale(value);
    },
  });
  
  const isJapanese = computed(() => currentLanguage.value === 'ja');
  const isEnglish = computed(() => currentLanguage.value === 'en');
  
  const setLanguage = (lang: SupportedLocale) => {
    currentLanguage.value = lang;
  };
  
  return {
    currentLanguage,
    isJapanese,
    isEnglish,
    setLanguage,
  };
}
