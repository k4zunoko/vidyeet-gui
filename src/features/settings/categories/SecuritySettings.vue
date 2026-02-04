<script setup lang="ts">
/**
 * セキュリティ設定カテゴリー
 *
 * 将来の拡張用（現在は空のカテゴリー）
 * - パスワード変更
 * - 2要素認証
 * - セッション管理
 */
import { useI18n } from "vue-i18n";
import SettingSection from "../components/SettingSection.vue";

const { t } = useI18n();
</script>

<template>
    <div class="security-settings">
        <SettingSection
            :title="t('settings.security.section.security')"
            :description="t('settings.security.section.securityDesc')"
        >
            <div class="empty-state">
                <span class="empty-icon">🔒</span>
                <p class="empty-title">{{ t("settings.security.empty.title") }}</p>
                <p class="empty-description">{{ t("settings.security.empty.description") }}</p>
            </div>
        </SettingSection>
    </div>
</template>

<style scoped>
.security-settings {
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    text-align: center;
    background: var(--color-surface-dark);
    border: 1px dashed var(--color-border);
    border-radius: 12px;
}

.empty-icon {
    font-size: 2.5rem;
    margin-bottom: 0.75rem;
    opacity: 0.6;
}

.empty-title {
    margin: 0 0 0.5rem 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
}

.empty-description {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    max-width: 280px;
    line-height: 1.5;
}
</style>
