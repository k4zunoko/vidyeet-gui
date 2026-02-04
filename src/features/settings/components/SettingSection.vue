<script setup lang="ts">
/**
 * 設定セクションラッパーコンポーネント
 *
 * カテゴリー内の設定をグループ化
 */
interface Props {
    title: string;
    description?: string;
}

defineProps<Props>();
</script>

<template>
    <section class="setting-section">
        <header class="setting-section-header">
            <h3 class="setting-section-title">{{ title }}</h3>
            <p
                v-if="description"
                class="setting-section-description"
            >{{ description }}</p>
        </header>
        <div class="setting-section-content">
            <slot />
        </div>
    </section>
</template>

<style scoped>
.setting-section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.setting-section-header {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.setting-section-title {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.setting-section-description {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    line-height: 1.4;
}

.setting-section-content {
    display: flex;
    flex-direction: column;
}
</style>
