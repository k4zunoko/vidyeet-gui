<script setup lang="ts">
/**
 * 動画カード
 *
 * 人間工学的UI/UX設計:
 * - Fitts' Law: 最小タッチターゲット44px以上を確保
 * - Micro-interactions: ホバー時のスケール・オーバーレイ表示でフィードバック
 * - 認知負荷軽減: 動画の長さをバッジ表示
 * - 視覚的ヒエラルキー: 選択状態を明確なボーダー＋グローで表現
 *
 * @see docs/UI_SPEC.md - 一覧画面（Library）
 */
import { ref, computed } from 'vue';
import type { VideoItem } from '../../types/app';
import { getThumbnailUrl, getAnimatedGifUrl } from '../../utils/muxUrls';

const props = defineProps<{
  video: VideoItem;
  isSelected: boolean;
}>();

const emit = defineEmits<{
  select: [video: VideoItem];
}>();

// ホバー状態
const isHovering = ref(false);

// 画像読み込みエラー
const hasImageError = ref(false);

// 表示するURL
const displayUrl = computed(() => {
  if (!props.video.playbackId || hasImageError.value) {
    return null;
  }
  // ホバー中はGIF、それ以外はサムネイル
  return isHovering.value
    ? getAnimatedGifUrl(props.video.playbackId)
    : getThumbnailUrl(props.video.playbackId);
});

/**
 * 再生時間をフォーマット (mm:ss)
 */
const formattedDuration = computed(() => {
  const seconds = props.video.duration;
  if (seconds === undefined || seconds === null) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
});

function handleClick() {
  if (props.video.playbackId) {
    emit('select', props.video);
  }
}

function handleImageError() {
  hasImageError.value = true;
}

function handleMouseEnter() {
  isHovering.value = true;
}

function handleMouseLeave() {
  isHovering.value = false;
}
</script>

<template>
  <div
    class="video-card"
    :class="{
      'is-selected': isSelected,
      'is-disabled': !video.playbackId,
      'is-hovering': isHovering
    }"
    role="button"
    tabindex="0"
    :aria-label="`動画 ${formattedDuration || ''}`"
    :aria-pressed="isSelected"
    @click="handleClick"
    @keydown.enter="handleClick"
    @keydown.space.prevent="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    @focus="handleMouseEnter"
    @blur="handleMouseLeave"
  >
    <div class="thumbnail-container">
      <!-- サムネイル/GIF -->
      <img
        v-if="displayUrl"
        :src="displayUrl"
        alt=""
        class="thumbnail"
        loading="lazy"
        @error="handleImageError"
      />
      <!-- プレースホルダ -->
      <div v-else class="thumbnail-placeholder">
        <svg class="placeholder-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9.5 12l2.5 3.01L14.5 12l4 5H5l4.5-5z"/>
        </svg>
        <span v-if="!video.playbackId" class="placeholder-text">再生不可</span>
      </div>

      <!-- 再生時間バッジ -->
      <div v-if="formattedDuration && !isSelected" class="duration-badge">
        {{ formattedDuration }}
      </div>

      <!-- ホバーオーバーレイ（再生アイコン） -->
      <div v-if="isHovering && video.playbackId && !isSelected" class="hover-overlay">
        <svg class="play-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>

      <!-- 選択中オーバーレイ -->
      <div v-if="isSelected" class="selected-overlay">
        <svg class="playing-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v9.28a4.39 4.39 0 00-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>
        </svg>
        <span class="playing-text">再生中</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-card {
  position: relative;
  background: var(--color-surface);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  /* Fitts' Law: 最小44pxのタッチターゲット確保 */
  min-height: 48px;
  /* スムーズなトランジション */
  transition:
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.2s ease;
  border: 2px solid transparent;
  /* フォーカス時のアウトライン対応 */
  outline: none;
}

/* ホバー状態 - Micro-interaction */
.video-card:hover:not(.is-disabled),
.video-card:focus-visible:not(.is-disabled) {
  transform: scale(1.02);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  border-color: var(--color-surface-hover);
}

/* フォーカス可視化（アクセシビリティ） */
.video-card:focus-visible {
  box-shadow: 0 0 0 3px var(--color-primary-alpha, rgba(255, 42, 130, 0.4));
}

/* 選択状態 - 明確な視覚的ヒエラルキー */
.video-card.is-selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary), 0 4px 16px rgba(255, 42, 130, 0.3);
  transform: scale(1);
}

.video-card.is-selected:hover {
  transform: scale(1);
}

/* 無効状態 */
.video-card.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
  filter: grayscale(0.5);
}

.thumbnail-container {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--color-surface-dark);
  overflow: hidden;
}

.thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ホバー時のズームイン効果 */
.video-card.is-hovering:not(.is-selected) .thumbnail {
  transform: scale(1.05);
}

.thumbnail-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: var(--color-surface-dark);
  gap: 0.5rem;
}

.placeholder-icon {
  width: 32px;
  height: 32px;
  color: var(--color-text-muted);
  opacity: 0.5;
}

.placeholder-text {
  font-size: 0.625rem;
  color: var(--color-text-muted);
}

/* 再生時間バッジ */
.duration-badge {
  position: absolute;
  bottom: 6px;
  right: 6px;
  padding: 2px 6px;
  font-size: 0.625rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: white;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 4px;
  backdrop-filter: blur(4px);
}

/* ホバーオーバーレイ */
.hover-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  animation: fadeIn 0.2s ease forwards;
}

@keyframes fadeIn {
  to { opacity: 1; }
}

.play-icon {
  width: 40px;
  height: 40px;
  color: white;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  transition: transform 0.15s ease;
}

.video-card:hover .play-icon {
  transform: scale(1.1);
}

/* 選択中オーバーレイ */
.selected-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  background: rgba(255, 42, 130, 0.15);
  backdrop-filter: blur(1px);
}

.playing-icon {
  width: 24px;
  height: 24px;
  color: var(--color-primary);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.95); }
}

.playing-text {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--color-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
