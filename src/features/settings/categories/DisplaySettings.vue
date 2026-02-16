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
import { useLanguage } from "../../../composables/useLanguage";
import { useAutoLaunch } from "../../../composables/useAutoLaunch";
import type { SupportedLocale } from "../../../i18n";

const { t } = useI18n();
const { currentLanguage, setLanguage } = useLanguage();
const { enabled, isLoading, error, loadState, setAutoLaunch } = useAutoLaunch();

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

onMounted(async () => {
    await loadState();
});
</script>

<template>
    <div class="display-settings">
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
</style>
