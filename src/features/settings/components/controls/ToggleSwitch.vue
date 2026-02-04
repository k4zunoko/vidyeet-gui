<script setup lang="ts">
/**
 * トグルスイッチコンポーネント
 *
 * 即時に有効/無効が切り替わる2値設定に使用
 * アクセシビリティ: role="switch", aria-checked対応
 */
interface Props {
    modelValue: boolean;
    label: string;
    description?: string;
    disabled?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    "update:modelValue": [value: boolean];
}>();

function handleToggle() {
    if (props.disabled) return;
    emit("update:modelValue", !props.modelValue);
}

function handleKeydown(event: KeyboardEvent) {
    if (props.disabled) return;
    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        emit("update:modelValue", !props.modelValue);
    }
}
</script>

<template>
    <div
        class="toggle-switch"
        :class="{ 'is-disabled': disabled }"
    >
        <div class="toggle-content">
            <span class="toggle-label">{{ label }}</span>
            <span
                v-if="description"
                class="toggle-description"
            >{{ description }}</span>
        </div>
        <button
            type="button"
            role="switch"
            class="toggle-button"
            :aria-checked="modelValue"
            :disabled="disabled"
            @click="handleToggle"
            @keydown="handleKeydown"
        >
            <span class="toggle-track">
                <span class="toggle-thumb"></span>
            </span>
        </button>
    </div>
</template>

<style scoped>
.toggle-switch {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 0;
}

.toggle-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
}

.toggle-label {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-text);
    line-height: 1.4;
}

.toggle-description {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    line-height: 1.4;
}

.toggle-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 28px;
    padding: 0;
    background: transparent;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    position: relative;
}

.toggle-button:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    border-radius: 14px;
}

.toggle-button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

.toggle-track {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--color-border);
    border-radius: 14px;
    position: relative;
    transition: background 0.2s ease;
}

.toggle-button[aria-checked="true"] .toggle-track {
    background: var(--color-primary);
}

.toggle-thumb {
    display: block;
    width: 22px;
    height: 22px;
    background: white;
    border-radius: 50%;
    position: absolute;
    top: 3px;
    left: 3px;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-button[aria-checked="true"] .toggle-thumb {
    transform: translateX(20px);
}

.toggle-switch.is-disabled .toggle-label,
.toggle-switch.is-disabled .toggle-description {
    opacity: 0.6;
}
</style>
