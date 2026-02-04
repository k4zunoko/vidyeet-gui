<script setup lang="ts">
/**
 * データ設定カテゴリー
 *
 * コピーテンプレート管理
 */
import { useI18n } from "vue-i18n";
import SettingSection from "../components/SettingSection.vue";
import CopyTemplateSettings from "../../../components/CopyTemplateSettings.vue";

const { t } = useI18n();
</script>

<template>
    <div class="data-settings">
        <SettingSection
            :title="t('settings.data.section.templates')"
            :description="t('settings.data.section.templatesDesc')"
        >
            <CopyTemplateSettings />
        </SettingSection>
    </div>
</template>

<style scoped>
.data-settings {
    display: flex;
    flex-direction: column;
    gap: 2rem;
}
</style>
