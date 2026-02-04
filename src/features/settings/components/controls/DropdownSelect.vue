<script setup lang="ts">
/**
 * ドロップダウン選択コンポーネント
 *
 * 選択肢が多い（6個以上）場合に使用
 * ネイティブselect要素を使用（アクセシビリティとシンプルさのため）
 */
interface SelectOption {
    value: string;
    label: string;
}

interface Props {
    modelValue: string;
    options: SelectOption[];
    label: string;
    description?: string;
    placeholder?: string;
    disabled?: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
    "update:modelValue": [value: string];
}>();

function handleChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    emit("update:modelValue", target.value);
}
</script>

<template>
    <div
        class="dropdown-select"
        :class="{ 'is-disabled': disabled }"
    >
        <label
            :for="`select-${label}`"
            class="dropdown-label"
        >{{ label }}</label>
        <p
            v-if="description"
            :id="`desc-${label}`"
            class="dropdown-description"
        >{{ description }}</p>

        <div class="dropdown-wrapper">
            <select
                :id="`select-${label}`"
                class="dropdown-input"
                :value="modelValue"
                :disabled="disabled"
                :aria-describedby="description ? `desc-${label}` : undefined"
                @change="handleChange"
            >
                <option
                    v-if="placeholder"
                    value=""
                    disabled
                >{{ placeholder }}</option>
                <option
                    v-for="option in options"
                    :key="option.value"
                    :value="option.value"
                >{{ option.label }}</option>
            </select>
            <span class="dropdown-arrow">
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                >
                    <path
                        d="M2 4L6 8L10 4"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                </svg>
            </span>
        </div>
    </div>
</template>

<style scoped>
.dropdown-select {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.dropdown-label {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-text);
}

.dropdown-description {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.4;
}

.dropdown-wrapper {
    position: relative;
}

.dropdown-input {
    width: 100%;
    padding: 0.625rem 2.5rem 0.625rem 0.875rem;
    font-size: 0.9375rem;
    color: var(--color-text);
    background: var(--color-surface-dark);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    cursor: pointer;
    appearance: none;
    transition: border-color 0.15s ease;
    font-family: inherit;
}

.dropdown-input:hover:not(:disabled) {
    border-color: var(--color-primary-alpha, rgba(250, 80, 181, 0.3));
}

.dropdown-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-alpha, rgba(250, 80, 181, 0.2));
}

.dropdown-input:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    background: var(--color-bg);
}

.dropdown-arrow {
    position: absolute;
    right: 0.875rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-text-muted);
    pointer-events: none;
}

.dropdown-select.is-disabled .dropdown-label,
.dropdown-select.is-disabled .dropdown-description {
    opacity: 0.6;
}
</style>
