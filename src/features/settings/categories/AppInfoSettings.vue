<script setup lang="ts">
/**
 * アプリ情報設定カテゴリー
 *
 * バージョン情報、アップデート、アプリ情報
 */
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import SettingSection from "../components/SettingSection.vue";
import SettingItem from "../components/SettingItem.vue";
import AppInfoUpdateSection from "./AppInfoUpdateSection.vue";

const { t } = useI18n();

// アプリケーション情報
import packageJson from "../../../../package.json";

const appVersion = ref(packageJson.version);
const cliPath = ref(t("settings.appInfo.loading"));

onMounted(() => {
    cliPath.value = "bin/vidyeet-cli.exe";
});
</script>

<template>
    <div class="app-info-settings">
        <SettingSection
            :title="t('settings.appInfo.section.info')"
            :description="t('settings.appInfo.section.infoDesc')"
        >
            <SettingItem
                :label="t('settings.appInfo.version')"
                :description="t('settings.appInfo.versionDesc')"
            >
                <span class="info-value">v{{ appVersion }}</span>
            </SettingItem>

            <SettingItem
                :label="t('settings.appInfo.cliPath')"
                :description="t('settings.appInfo.cliPathDesc')"
            >
                <code class="code-value">{{ cliPath }}</code>
            </SettingItem>
        </SettingSection>

        <AppInfoUpdateSection />
    </div>
</template>

<style scoped>
.app-info-settings {
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.info-value {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
}

.code-value {
    display: inline-block;
    padding: 0.375rem 0.75rem;
    font-family: "Consolas", "Monaco", "Courier New", monospace;
    font-size: 0.8125rem;
    color: var(--color-text);
    background: var(--color-surface-dark);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
