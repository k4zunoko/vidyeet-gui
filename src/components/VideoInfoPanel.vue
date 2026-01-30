<script setup lang="ts">
/**
 * 動画情報表示パネル
 *
 * 選択中の動画のメタ情報を表示
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { VideoItem } from '../types/app';

const props = defineProps<{
  video: VideoItem | null;
}>();

const { t } = useI18n();

/**
 * 再生時間をフォーマット (mm:ss)
 */
function formatDuration(seconds?: number): string {
  if (seconds === undefined || seconds === null) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 作成日時をフォーマット
 */
function formatDate(timestamp?: string): string {
  if (!timestamp) return '-';
  try {
    const date = new Date(parseInt(timestamp, 10) * 1000);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return '-';
  }
}

/**
 * フレームレートをフォーマット
 */
function formatFrameRate(fps?: number): string {
  if (fps === undefined || fps === null) return '-';
  return `${fps.toFixed(1)} fps`;
}

const infoItems = computed(() => {
   if (!props.video) return [];

   return [
     { label: t('infoPanel.duration'), value: formatDuration(props.video.duration) },
     { label: t('infoPanel.resolution'), value: props.video.resolutionTier || '-' },
     { label: t('infoPanel.aspectRatio'), value: props.video.aspectRatio || '-' },
     { label: t('infoPanel.frameRate'), value: formatFrameRate(props.video.maxFrameRate) },
     { label: t('infoPanel.createdAt'), value: formatDate(props.video.createdAt) },
     { label: t('infoPanel.status'), value: props.video.status || '-' },
   ];
});
</script>

<template>
  <div class="info-panel">
    <div v-if="video" class="info-grid">
      <div v-for="item in infoItems" :key="item.label" class="info-item">
        <span class="info-label">{{ item.label }}</span>
        <span class="info-value">{{ item.value }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.info-panel {
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  padding: 0.75rem 1rem;
  min-height: 48px;
}

.info-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.info-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.info-value {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text);
}
</style>
