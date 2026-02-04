<script setup lang="ts">
/**
 * ラジオボタングループコンポーネント
 *
 * 排他的な複数選択（2-5個）に使用
 * 必ずデフォルト選択を設定すること
 * アクセシビリティ: fieldset/legend, label関連付け対応
 */
interface RadioOption {
    value: string;
    label: string;
    description?: string;
}

interface Props {
    modelValue: string;
    options: RadioOption[];
    name: string;
    label?: string;
    description?: string;
    disabled?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    "update:modelValue": [value: string];
}>();

function handleChange(value: string) {
    if (props.disabled) return;
    emit("update:modelValue", value);
}
</script>

<template>
    <fieldset
        class="radio-group"
        :class="{ 'is-disabled': disabled }"
    >
        <legend
            v-if="label"
            class="radio-group-label"
        >{{ label }}</legend>
        <p
            v-if="description"
            class="radio-group-description"
        >{{ description }}</p>

        <div class="radio-options">
            <label
                v-for="option in options"
                :key="option.value"
                class="radio-option"
                :class="{ 'is-selected': modelValue === option.value }"
            >
                <input
                    type="radio"
                    :name="name"
                    :value="option.value"
                    :checked="modelValue === option.value"
                    :disabled="disabled"
                    class="radio-input"
                    @change="handleChange(option.value)"
                />
                <span class="radio-control">
                    <span class="radio-circle"></span>
                </span>
                <span class="radio-content">
                    <span class="radio-label">{{ option.label }}</span>
                    <span
                        v-if="option.description"
                        class="radio-option-description"
                    >{{ option.description }}</span>
                </span>
            </label>
        </div>
    </fieldset>
</template>

<style scoped>
.radio-group {
    border: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.radio-group-label {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-text);
    padding: 0;
    margin-bottom: 0.25rem;
}

.radio-group-description {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    margin: 0 0 0.75rem 0;
    line-height: 1.4;
}

.radio-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.radio-option {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--color-surface-dark);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.radio-option:hover:not(.is-disabled) {
    background: var(--color-surface-hover);
    border-color: var(--color-primary-alpha, rgba(250, 80, 181, 0.3));
}

.radio-option.is-selected {
    border-color: var(--color-primary);
    background: rgba(250, 80, 181, 0.08);
}

.radio-input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
}

.radio-input:focus-visible + .radio-control {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
}

.radio-control {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-text-muted);
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 1px;
    transition: all 0.15s ease;
}

.radio-option.is-selected .radio-control {
    border-color: var(--color-primary);
}

.radio-circle {
    width: 10px;
    height: 10px;
    background: var(--color-primary);
    border-radius: 50%;
    transform: scale(0);
    transition: transform 0.15s ease;
}

.radio-option.is-selected .radio-circle {
    transform: scale(1);
}

.radio-content {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
    min-width: 0;
}

.radio-label {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-text);
    line-height: 1.3;
}

.radio-option-description {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    line-height: 1.4;
}

.radio-group.is-disabled .radio-option {
    cursor: not-allowed;
    opacity: 0.6;
}

.radio-input:disabled + .radio-control {
    opacity: 0.5;
}
</style>
