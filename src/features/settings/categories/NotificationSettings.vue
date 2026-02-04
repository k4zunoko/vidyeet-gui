<script setup lang="ts">
/**
 * 通知設定カテゴリー
 *
 * 将来の拡張用（現在は空のカテゴリー）
 * - アップロード完了通知
 * - エラー通知
 * - サウンド設定
 */
import { useI18n } from "vue-i18n";
import SettingSection from "../components/SettingSection.vue";

const { t } = useI18n();
</script>

<template>
    <div class="notification-settings">
        <SettingSection
            :title="t('settings.notification.section.notification')"
            :description="t('settings.notification.section.notificationDesc')"
        >
            <div class="empty-state">
                <span class="empty-icon">🔔</span>
                <p class="empty-title">{{ t("settings.notification.empty.title") }}</p>
                <p class="empty-description">{{ t("settings.notification.empty.description") }}</p>
            </div>
        </SettingSection>
    </div>
</template>

<style scoped>
.notification-settings {
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
