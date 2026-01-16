<script setup lang="ts">
/**
 * DragDropOverlay - ドラッグアンドドロップ時の視覚的フィードバック
 *
 * UI/UX原則:
 * - 視覚的階層: オーバーレイを最前面に配置し、メッセージを中央に
 * - 認知負荷: シンプルなアイコンと明確なメッセージ
 * - 段階的開示: ドラッグ中のみ表示
 * - フレーミング効果: 肯定的な言葉で誘導
 * - ドハティの閾値: 即座に視覚的フィードバックを提供
 *
 * @see docs/UX_PSYCHOLOGY.md - UI/UX設計の原則
 */

interface Props {
    isDragging: boolean;
}

defineProps<Props>();
</script>

<template>
    <Transition name="overlay">
        <div v-if="isDragging" class="drag-drop-overlay">
            <div class="overlay-content">
                <div class="upload-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                </div>
                <p class="overlay-message">ここにファイルをドロップしてアップロード</p>
                <p class="overlay-hint">動画ファイルのみ対応しています</p>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.drag-drop-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(26, 26, 26, 0.95);
    border: 4px dashed var(--color-primary);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    pointer-events: none;
}

.overlay-content {
    text-align: center;
    color: var(--color-text);
}

.upload-icon {
    color: var(--color-primary);
    margin-bottom: 1.5rem;
    animation: bounce 1s ease-in-out infinite;
}

.overlay-message {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: var(--color-text);
}

.overlay-hint {
    font-size: 1rem;
    margin: 0;
    color: var(--color-text-muted);
}

@keyframes bounce {
    0%, 100% {
        transform: translateY(0);
    }
    50% {
        transform: translateY(-10px);
    }
}

.overlay-enter-active,
.overlay-leave-active {
    transition: opacity 0.2s ease;
}

.overlay-enter-from,
.overlay-leave-to {
    opacity: 0;
}
</style>
