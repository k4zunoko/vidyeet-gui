<script setup lang="ts">
/**
 * 動画カード
 *
 * サムネイル表示 + ホバーでGIF表示
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
    :class="{ 'is-selected': isSelected, 'is-disabled': !video.playbackId }"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div class="thumbnail-container">
      <!-- サムネイル/GIF -->
      <img
        v-if="displayUrl"
        :src="displayUrl"
        :alt="`Video ${video.assetId}`"
        class="thumbnail"
        @error="handleImageError"
      />
      <!-- プレースホルダ -->
      <div v-else class="thumbnail-placeholder">
        <span v-if="!video.playbackId" class="placeholder-text">再生不可</span>
        <span v-else class="placeholder-text">読み込みエラー</span>
      </div>
    </div>

    <!-- 選択インジケータ -->
    <div v-if="isSelected" class="selected-indicator">
      <span class="selected-badge">再生中</span>
    </div>

    <!-- アセットID（デバッグ用、将来は非表示にしてもよい） -->
    <div class="card-footer">
      <span class="asset-id" :title="video.assetId">
        {{ video.assetId.slice(0, 8) }}...
      </span>
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
  transition: transform 0.2s, box-shadow 0.2s;
  border: 2px solid transparent;
}

.video-card:hover:not(.is-disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.video-card.is-selected {
  border-color: var(--color-primary);
}

.video-card.is-disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.thumbnail-container {
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--color-surface-dark);
}

.thumbnail {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumbnail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: var(--color-surface-dark);
}

.placeholder-text {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.selected-indicator {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}

.selected-badge {
  padding: 0.25rem 0.5rem;
  font-size: 0.625rem;
  font-weight: 600;
  color: white;
  background: var(--color-primary);
  border-radius: 4px;
}

.card-footer {
  padding: 0.5rem;
}

.asset-id {
  font-size: 0.625rem;
  font-family: monospace;
  color: var(--color-text-muted);
}
</style>
