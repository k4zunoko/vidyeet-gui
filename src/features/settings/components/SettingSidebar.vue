<script setup lang="ts">
/**
 * 設定サイドバーナビゲーション
 *
 * カテゴリー間を切り替えるためのサイドバー
 * アクセシビリティ: aria-current対応
 */
import { useI18n } from 'vue-i18n';

interface Category {
    id: string;
    label: string;
    icon: string;
}

interface Props {
    categories: Category[];
    activeCategory: string;
}

defineProps<Props>();

const emit = defineEmits<{
    select: [categoryId: string];
}>();

const { t } = useI18n();

function handleSelect(categoryId: string) {
    emit("select", categoryId);
}
</script>

<template>
    <aside class="settings-sidebar">
        <nav class="sidebar-nav" :aria-label="t('settings.categoriesAriaLabel')">
            <ul class="category-list">
                <li
                    v-for="category in categories"
                    :key="category.id"
                    class="category-item"
                >
                    <button
                        type="button"
                        class="category-button"
                        :class="{ active: activeCategory === category.id }"
                        :aria-current="
                            activeCategory === category.id ? 'page' : undefined
                        "
                        @click="handleSelect(category.id)"
                    >
                        <span class="category-label">{{ category.label }}</span>
                    </button>
                </li>
            </ul>
        </nav>
    </aside>
</template>

<style scoped>
.settings-sidebar {
    width: 200px;
    flex-shrink: 0;
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
    padding: 1rem 0.75rem;
    overflow-y: auto;
}

.sidebar-nav {
    height: 100%;
}

.category-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.category-button {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-muted);
    background: transparent;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
}

.category-button:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
}

.category-button:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: -2px;
}

.category-button.active {
    background: var(--color-primary-alpha, rgba(250, 80, 181, 0.15));
    color: var(--color-primary);
    font-weight: 600;
}

.category-icon {
    font-size: 1.125rem;
    line-height: 1;
    flex-shrink: 0;
}

.category-label {
    line-height: 1.3;
}

/* スクロールバー */
.settings-sidebar::-webkit-scrollbar {
    width: 6px;
}

.settings-sidebar::-webkit-scrollbar-track {
    background: transparent;
}

.settings-sidebar::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
}

.settings-sidebar::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-muted);
}
</style>
