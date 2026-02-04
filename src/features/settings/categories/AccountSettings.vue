<script setup lang="ts">
/**
 * アカウント設定カテゴリー
 *
 * 認証状態、ログアウト機能
 */
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import SettingSection from "../components/SettingSection.vue";
import SettingItem from "../components/SettingItem.vue";

const { t } = useI18n();

const emit = defineEmits<{
    logout: [];
}>();

const authStatus = computed(() => {
    // 認証状態は親コンポーネントからpropsで渡すか、グローバル状態から取得
    // ここでは仮に「認証済み」と表示
    return t("settings.account.authenticated");
});

function handleLogout() {
    emit("logout");
}
</script>

<template>
    <div class="account-settings">
        <SettingSection
            :title="t('settings.account.section.account')"
            :description="t('settings.account.section.accountDesc')"
        >
            <SettingItem
                :label="t('settings.account.status')"
                :description="t('settings.account.statusDesc')"
            >
                <span class="auth-status">{{ authStatus }}</span>
            </SettingItem>

            <SettingItem
                :label="t('settings.account.logoutLabel')"
                :description="t('settings.account.logoutDesc')"
            >
                <button
                    type="button"
                    class="logout-button"
                    @click="handleLogout"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path d="M3 3h8v2H5v10h6v2H3V3zm10 4l4 3-4 3v-2H8V9h5V7z" />
                    </svg>
                    {{ t("settings.account.logout") }}
                </button>
            </SettingItem>
        </SettingSection>
    </div>
</template>

<style scoped>
.account-settings {
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.auth-status {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.875rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-success);
    background: rgba(81, 207, 102, 0.12);
    border-radius: 999px;
}

.auth-status::before {
    content: "";
    width: 8px;
    height: 8px;
    background: var(--color-success);
    border-radius: 50%;
}

.logout-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-error);
    background: transparent;
    border: 1px solid var(--color-error);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.logout-button:hover {
    background: var(--color-error);
    color: white;
}

.logout-button:focus-visible {
    outline: 2px solid var(--color-error);
    outline-offset: 2px;
}
</style>
