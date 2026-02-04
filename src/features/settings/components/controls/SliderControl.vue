<script setup lang="ts">
/**
 * スライダーコントロールコンポーネント
 *
 * 連続量で"感覚的調整"が必要な設定に使用（音量、速度など）
 * アクセシビリティ: aria-valuemin, aria-valuemax, aria-valuenow対応
 */
interface Props {
    modelValue: number;
    min: number;
    max: number;
    step?: number;
    label: string;
    unit?: string;
    description?: string;
    showValue?: boolean;
    disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    step: 1,
    showValue: true,
});

const emit = defineEmits<{
    "update:modelValue": [value: number];
}>();

function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = parseFloat(target.value);
    emit("update:modelValue", value);
}

function formatValue(value: number): string {
    if (props.unit) {
        return `${value}${props.unit}`;
    }
    return value.toString();
}
</script>

<template>
    <div
        class="slider-control"
        :class="{ 'is-disabled': disabled }"
    >
        <div class="slider-header">
            <label
                :for="`slider-${label}`"
                class="slider-label"
            >{{ label }}</label>
            <span
                v-if="showValue"
                class="slider-value"
                aria-live="polite"
            >{{ formatValue(modelValue) }}</span>
        </div>
        <p
            v-if="description"
            :id="`desc-${label}`"
            class="slider-description"
        >{{ description }}</p>

        <div class="slider-container">
            <input
                :id="`slider-${label}`"
                type="range"
                class="slider-input"
                :min="min"
                :max="max"
                :step="step"
                :value="modelValue"
                :disabled="disabled"
                :aria-valuemin="min"
                :aria-valuemax="max"
                :aria-valuenow="modelValue"
                :aria-label="label"
                :aria-describedby="description ? `desc-${label}` : undefined"
                @input="handleInput"
            />
            <div class="slider-labels">
                <span class="slider-min">{{ formatValue(min) }}</span>
                <span class="slider-max">{{ formatValue(max) }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.slider-control {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.slider-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
}

.slider-label {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-text);
}

.slider-value {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-primary);
    font-variant-numeric: tabular-nums;
}

.slider-description {
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    margin: 0;
    line-height: 1.4;
}

.slider-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.25rem;
}

.slider-input {
    width: 100%;
    height: 6px;
    background: var(--color-border);
    border-radius: 3px;
    outline: none;
    appearance: none;
    cursor: pointer;
}

.slider-input::-webkit-slider-thumb {
    appearance: none;
    width: 18px;
    height: 18px;
    background: var(--color-primary);
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.slider-input::-webkit-slider-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 2px 6px rgba(250, 80, 181, 0.4);
}

.slider-input::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: var(--color-primary);
    border-radius: 50%;
    cursor: pointer;
    border: none;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.slider-input::-moz-range-thumb:hover {
    transform: scale(1.1);
}

.slider-input:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
}

.slider-input:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

.slider-input:disabled::-webkit-slider-thumb {
    cursor: not-allowed;
}

.slider-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--color-text-muted);
}

.slider-min,
.slider-max {
    font-variant-numeric: tabular-nums;
}

.slider-control.is-disabled .slider-label,
.slider-control.is-disabled .slider-description {
    opacity: 0.6;
}
</style>
