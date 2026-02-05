<script setup lang="ts">
/**
 * 表示設定カテゴリー
 *
 * 言語設定、テーマ、その他表示オプション
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import SettingSection from "../components/SettingSection.vue";
import SettingItem from "../components/SettingItem.vue";
import RadioGroup from "../components/controls/RadioGroup.vue";
import { useLanguage } from "../../../composables/useLanguage";
import type { SupportedLocale } from "../../../i18n";

const { t } = useI18n();
const { currentLanguage, setLanguage } = useLanguage();

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
    </div>
</template>

<style scoped>
.display-settings {
    display: flex;
    flex-direction: column;
    gap: 2rem;
}
</style>
