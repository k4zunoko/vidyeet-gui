<script setup lang="ts">
/**
 * トースト通知コンポーネント
 *
 * アクション完了のフィードバックをユーザーに提供
 *
 * 人間工学的UI/UX設計:
 * - ピーク・エンドの法則: 成功時は短く肯定的なメッセージで良い印象を残す
 * - ドハティの閾値: 即時表示（0.4秒以内）でフィードバック
 * - 認知負荷: 最小限の情報量（アイコン + 短いメッセージ）
 * - 視覚的階層: タイプ別の色分け（成功=緑、エラー=赤、情報=グレー）
 * - バナー・ブラインドネス: 控えめだが見落とされないデザイン
 *
 * @see docs/UI_SPEC.md - トースト通知
 * @see docs/UX_PSYCHOLOGY.md - ピーク・エンドの法則
 */
import { useI18n } from 'vue-i18n';
import type { ToastItem } from "../types/app";

defineProps<{
     /** 表示するトースト一覧 */
     toasts: ToastItem[];
 }>();

const emit = defineEmits<{
     /** トーストを閉じる */
     close: [id: number];
 }>();

const { t } = useI18n();

/**
 * タイプ別のアイコンを返す
 */
function getIcon(type: ToastItem["type"]): string {
    switch (type) {
        case "success":
            return "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"; // チェックマーク
        case "error":
            return "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"; // エラー
        case "info":
        default:
            return "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"; // 情報
    }
}
</script>

<template>
    <Teleport to="body">
        <div class="toast-container" aria-live="polite" aria-atomic="true">
            <TransitionGroup name="toast">
                <div
                    v-for="toast in toasts"
                    :key="toast.id"
                    :class="['toast', `toast--${toast.type}`]"
                    role="alert"
                >
                    <svg
                        class="toast-icon"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <path :d="getIcon(toast.type)" />
                    </svg>
                    <span class="toast-message">{{ toast.message }}</span>
                    <button
                         class="toast-close"
                         @click="emit('close', toast.id)"
                         :aria-label="t('toast.close')"
                     >
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path
                                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                            />
                        </svg>
                    </button>
                </div>
            </TransitionGroup>
        </div>
    </Teleport>
</template>

<style scoped>
.toast-container {
    position: fixed;
    top: 3rem;
    right: 1rem;
    z-index: 10001;
    display: flex;
    flex-direction: column-reverse;
    gap: 0.5rem;
    pointer-events: none;
    /* 最大3件まで表示 */
    max-height: calc(3 * 56px + 2 * 0.5rem);
    overflow: hidden;
}

.toast {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    min-width: 240px;
    max-width: 360px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow:
        0 4px 16px rgba(0, 0, 0, 0.3),
        0 2px 4px rgba(0, 0, 0, 0.2);
    pointer-events: auto;
}

/* タイプ別の左ボーダー */
.toast--success {
    border-left: 3px solid var(--color-success, #51cf66);
}

.toast--error {
    border-left: 3px solid var(--color-error, #ff6b6b);
}

.toast--info {
    border-left: 3px solid var(--color-primary, #fa50b5);
}

.toast-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
}

.toast--success .toast-icon {
    color: var(--color-success, #51cf66);
}

.toast--error .toast-icon {
    color: var(--color-error, #ff6b6b);
}

.toast--info .toast-icon {
    color: var(--color-primary, #fa50b5);
}

.toast-message {
    flex: 1;
    font-size: 0.8125rem;
    color: var(--color-text);
    line-height: 1.4;
}

.toast-close {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--color-text-muted);
    cursor: pointer;
    transition:
        background 0.15s ease,
        color 0.15s ease;
}

.toast-close:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
}

.toast-close svg {
    width: 16px;
    height: 16px;
}

/* アニメーション */
.toast-enter-active {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-leave-active {
    transition: all 0.2s ease-in;
}

.toast-enter-from {
    opacity: 0;
    transform: translateX(100%);
}

.toast-leave-to {
    opacity: 0;
    transform: translateX(100%);
}

.toast-move {
    transition: transform 0.2s ease;
}
</style>
