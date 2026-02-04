<script setup lang="ts">
/**
 * 設定画面メインコンテナ
 *
 * サイドバーナビゲーション + カテゴリービュー
 * 人間工学に基づく7カテゴリー構成
 */
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import SettingSidebar from "./components/SettingSidebar.vue";
import AccountSettings from "./categories/AccountSettings.vue";
import SecuritySettings from "./categories/SecuritySettings.vue";
import NotificationSettings from "./categories/NotificationSettings.vue";
import DisplaySettings from "./categories/DisplaySettings.vue";
import DataSettings from "./categories/DataSettings.vue";
import SupportSettings from "./categories/SupportSettings.vue";
import AppInfoSettings from "./categories/AppInfoSettings.vue";

const { t } = useI18n();

interface Props {
    isOpen: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
    close: [];
    logout: [];
}>();

// アクティブなカテゴリー
const activeCategory = ref("account");

// カテゴリー定義
const categories = [
    {
        id: "account",
        label: t("settings.categories.account"),
        icon: "🔑",
    },
    {
        id: "security",
        label: t("settings.categories.security"),
        icon: "🔒",
    },
    {
        id: "notification",
        label: t("settings.categories.notification"),
        icon: "🔔",
    },
    {
        id: "display",
        label: t("settings.categories.display"),
        icon: "🎨",
    },
    {
        id: "data",
        label: t("settings.categories.data"),
        icon: "💾",
    },
    {
        id: "support",
        label: t("settings.categories.support"),
        icon: "❓",
    },
    {
        id: "appinfo",
        label: t("settings.categories.appinfo"),
        icon: "ℹ️",
    },
];

// アクティブなカテゴリーのコンポーネント
const activeComponent = computed(() => {
    switch (activeCategory.value) {
        case "account":
            return AccountSettings;
        case "security":
            return SecuritySettings;
        case "notification":
            return NotificationSettings;
        case "display":
            return DisplaySettings;
        case "data":
            return DataSettings;
        case "support":
            return SupportSettings;
        case "appinfo":
            return AppInfoSettings;
        default:
            return AccountSettings;
    }
});

// 現在のカテゴリーのラベル
const activeCategoryLabel = computed(() => {
    const category = categories.find((c) => c.id === activeCategory.value);
    return category?.label ?? "";
});

// カテゴリー切り替え
function handleCategorySelect(categoryId: string) {
    activeCategory.value = categoryId;
}

// モーダルを閉じる
function handleClose() {
    emit("close");
}

// オーバーレイクリックで閉じる
function handleOverlayClick() {
    emit("close");
}

// ログアウト
function handleLogout() {
    emit("logout");
}

// Escキーで閉じる
function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
        handleClose();
    }
}

onMounted(() => {
    document.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
    document.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
    <Teleport to="body">
        <!-- オーバーレイ -->
        <Transition name="settings-fade">
            <div
                v-if="isOpen"
                class="settings-overlay"
                @click="handleOverlayClick"
            />
        </Transition>

        <!-- モーダル本体 -->
        <Transition name="settings-modal">
            <div
                v-if="isOpen"
                class="settings-view"
                role="dialog"
                aria-labelledby="settings-title"
                aria-modal="true"
            >
                <!-- サイドバー -->
                <SettingSidebar
                    :categories="categories"
                    :active-category="activeCategory"
                    @select="handleCategorySelect"
                />

                <!-- メインコンテンツ -->
                <div class="settings-main">
                    <!-- ヘッダー -->
                    <header class="settings-header">
                        <h2 id="settings-title" class="settings-title">
                            {{ activeCategoryLabel }}
                        </h2>
                        <button
                            type="button"
                            class="settings-close"
                            :aria-label="t('settings.aria.close')"
                            :title="t('settings.aria.close')"
                            @click="handleClose"
                        >
                            <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                            >
                                <path
                                    d="M4 4l8 8M12 4l-8 8"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                />
                            </svg>
                        </button>
                    </header>

                    <!-- コンテンツ -->
                    <main class="settings-content">
                        <component
                            :is="activeComponent"
                            @logout="handleLogout"
                        />
                    </main>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
/* オーバーレイ */
.settings-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 200;
}

.settings-fade-enter-active,
.settings-fade-leave-active {
    transition: opacity 0.2s ease;
}

.settings-fade-enter-from,
.settings-fade-leave-to {
    opacity: 0;
}

/* モーダル本体 */
.settings-view {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 90%;
    max-width: 800px;
    max-height: 80vh;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
    z-index: 201;
    display: flex;
    overflow: hidden;
}

.settings-modal-enter-active,
.settings-modal-leave-active {
    transition:
        opacity 0.2s ease,
        transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.settings-modal-enter-from,
.settings-modal-leave-to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.95);
}

/* メインコンテンツ */
.settings-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: var(--color-bg);
}

/* ヘッダー */
.settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
}

.settings-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text);
}

.settings-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.15s ease;
}

.settings-close:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
}

.settings-close:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
}

/* コンテンツ */
.settings-content {
    flex: 1;
    padding: 1.5rem;
    overflow-y: auto;
}

/* スクロールバー */
.settings-content::-webkit-scrollbar {
    width: 8px;
}

.settings-content::-webkit-scrollbar-track {
    background: transparent;
}

.settings-content::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 4px;
}

.settings-content::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-muted);
}
</style>
