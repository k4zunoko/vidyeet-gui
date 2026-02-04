<script setup lang="ts">
/**
 * 設定項目ラッパーコンポーネント
 *
 * 個別の設定項目を統一的なスタイルでラップ
 */
interface Props {
    label: string;
    description?: string;
}

defineProps<Props>();
</script>

<template>
    <div class="setting-item">
        <div class="setting-item-content">
            <span class="setting-item-label">{{ label }}</span>
            <span
                v-if="description"
                class="setting-item-description"
            >{{ description }}</span>
        </div>
        <div class="setting-item-control">
            <slot />
        </div>
    </div>
</template>

<style scoped>
.setting-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 0;
}

.setting-item-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
}

.setting-item-label {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-text);
    line-height: 1.4;
}

.setting-item-description {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    line-height: 1.4;
}

.setting-item-control {
    flex-shrink: 0;
}
</style>
