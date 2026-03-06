<script setup lang="ts">
/**
 * 表示設定カテゴリー
 *
 * 言語設定、テーマ、その他表示オプション
 */
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import SettingSection from "../components/SettingSection.vue";
import SettingItem from "../components/SettingItem.vue";
import RadioGroup from "../components/controls/RadioGroup.vue";
import ToggleSwitch from "../components/controls/ToggleSwitch.vue";
import { useLanguage } from '../../../composables/useLanguage';
import { useTheme } from '../../../composables/useTheme';
import type { ThemeOption } from '../../../composables/useTheme';
import { useAutoLaunch } from '../../../composables/useAutoLaunch';
import { useRichPresence } from '../../../composables/useRichPresence';
import type { SupportedLocale } from '../../../i18n';

const { t } = useI18n();
const { currentLanguage, setLanguage } = useLanguage();
const { currentTheme, setTheme } = useTheme(); // Used in template
const { enabled, isLoading, error, loadState, setAutoLaunch } = useAutoLaunch();
const { enabled: richPresenceEnabled, isLoading: richPresenceLoading, error: richPresenceError, loadState: loadRichPresenceState, setRichPresence } = useRichPresence();

// 言語オプション（言語変更時にリアクティブに更新）
const languageOptions = computed(() => [
    {
        value: "ja",
        label: t("settings.language.ja"),
    },
    {
        value: "en",
        label: t("settings.language.en"),
    },
]);

function handleLanguageChange(value: string) {
    setLanguage(value as SupportedLocale);
}

// テーマオプション（テーマ変更時にリアクティブに更新）

const themeOptions = computed(() => [
    {
        value: 'light',
        label: t('settings.display.theme.light'),
    },
    {
        value: 'dark',
        label: t('settings.display.theme.dark'),
    },
    {
        value: 'system',
        label: t('settings.display.theme.system'),
    },
]);

function handleThemeChange(value: string) {
    setTheme(value as ThemeOption);
}

/**
 * Handle auto-launch toggle change
 * Reverts toggle on error
 */
async function handleAutoLaunchChange(value: boolean) {
    try {
        await setAutoLaunch(value);
    } catch (err) {
        // Error already handled in composable
        // setAutoLaunch will set error state and revert toggle internally
    }
}

/**
 * Handle Rich Presence toggle change
 * Reverts toggle on error
 */
async function handleRichPresenceChange(value: boolean) {
    try {
        await setRichPresence(value);
    } catch (err) {
        // Error already handled in composable
        // setRichPresence will set error state and revert toggle internally
    }
}

onMounted(async () => {
    await loadState();
    await loadRichPresenceState();
});
</script>

<template>
    <div class="display-settings">
        <SettingSection
            :title="t('settings.display.section.theme')"
            :description="t('settings.display.section.themeDesc')"
        >
            <SettingItem
                :label="t('settings.display.theme.label')"
                :description="t('settings.display.theme.description')"
            >
                <RadioGroup
                    v-model="currentTheme"
                    name="theme"
                    :options="themeOptions"
                    @update:model-value="handleThemeChange"
                />
            </SettingItem>
        </SettingSection>

        <SettingSection
            :title="t('settings.display.section.language')"
            :description="t('settings.display.section.languageDesc')"
        >
            <SettingItem
                :label="t('settings.display.language.label')"
                :description="t('settings.display.language.description')"
            >
                <RadioGroup
                    v-model="currentLanguage"
                    name="language"
                    :options="languageOptions"
                    @update:model-value="handleLanguageChange"
                />
            </SettingItem>
        </SettingSection>

        <SettingSection
            :title="t('settings.display.section.autoLaunch')"
        >
            <SettingItem
                v-if="error"
                :label="t('settings.display.autoLaunch.label')"
                :description="error"
                class="auto-launch-error"
            >
                <ToggleSwitch
                    :model-value="enabled"
                    :label="t('settings.display.autoLaunch.label')"
                    :disabled="isLoading"
                    @update:model-value="handleAutoLaunchChange"
                />
            </SettingItem>
            <ToggleSwitch
                v-else
                :model-value="enabled"
                :label="t('settings.display.autoLaunch.label')"
                :disabled="isLoading"
                @update:model-value="handleAutoLaunchChange"
            />
        </SettingSection>

        <SettingSection
            :title="t('settings.display.section.richPresence')"
        >
            <SettingItem
                v-if="richPresenceError"
                :label="t('settings.display.richPresence.label')"
                :description="richPresenceError"
                class="rich-presence-error"
            >
                <ToggleSwitch
                    :model-value="richPresenceEnabled"
                    :label="t('settings.display.richPresence.label')"
                    :disabled="richPresenceLoading"
                    @update:model-value="handleRichPresenceChange"
                />
            </SettingItem>
            <ToggleSwitch
                v-else
                :model-value="richPresenceEnabled"
                :label="t('settings.display.richPresence.label')"
                :disabled="richPresenceLoading"
                @update:model-value="handleRichPresenceChange"
            />
        </SettingSection>
    </div>
</template>

<style scoped>
.display-settings {
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.auto-launch-error {
    color: var(--color-error, #ef4444);
}

.rich-presence-error {
    color: var(--color-error, #ef4444);
}
</style>
