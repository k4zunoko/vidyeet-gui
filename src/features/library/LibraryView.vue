<script setup lang="ts">
/**
 * ライブラリ画面
 *
 * 動画一覧をグリッド表示 + 選択で再生
 * @see docs/UI_SPEC.md - 一覧画面（Library）
 */
import { ref, onMounted } from 'vue';
import type { VideoItem } from '../../types/app';
import { isIpcError } from '../../../electron/types/ipc';
import VideoCard from './VideoCard.vue';

defineProps<{
  /** 選択中の動画 */
  selectedVideo: VideoItem | null;
}>();

const emit = defineEmits<{
  /** 動画選択時 */
  select: [video: VideoItem];
  /** コンテキストメニュー表示要求 */
  contextmenu: [event: MouseEvent, video: VideoItem];
}>();

// 動画一覧
const videos = ref<VideoItem[]>([]);

// ローディング状態
const isLoading = ref(true);

// エラー状態
const errorMessage = ref<string | null>(null);

/**
 * 一覧を取得
 */
async function fetchVideos() {
  isLoading.value = true;
  errorMessage.value = null;

  try {
    const result = await window.vidyeet.list();

    if (isIpcError(result)) {
      errorMessage.value = '動画一覧の取得に失敗しました。再試行してください。';
      return;
    }

    videos.value = result.items.map((item) => ({
      assetId: item.assetId,
      playbackId: item.playbackId,
      duration: item.duration,
      status: item.status,
      resolutionTier: item.resolutionTier,
      aspectRatio: item.aspectRatio,
      maxFrameRate: item.maxFrameRate,
      createdAt: item.createdAt,
    }));
  } catch (err) {
    errorMessage.value = '予期しないエラーが発生しました。';
  } finally {
    isLoading.value = false;
  }
}

/**
 * 動画を選択
 */
function handleSelect(video: VideoItem) {
  emit('select', video);
}

/**
 * コンテキストメニュー要求を親に伝播
 */
function handleContextMenu(event: MouseEvent, video: VideoItem) {
  emit('contextmenu', event, video);
}

/**
 * 動画を一覧から削除（外部から呼び出し可能）
 */
function removeVideo(assetId: string) {
  videos.value = videos.value.filter((v) => v.assetId !== assetId);
}

/**
 * 再読み込み（外部から呼び出し可能）
 */
function reload() {
  fetchVideos();
}

// 外部から呼び出せるように公開
defineExpose({ reload, removeVideo });

onMounted(() => {
  fetchVideos();
});
</script>

<template>
  <div class="library-container">
    <!-- コンテンツ -->
    <main class="library-content">
      <!-- ローディング -->
      <div v-if="isLoading" class="loading-state">
        <div class="loading-grid">
          <div v-for="i in 8" :key="i" class="skeleton-card">
            <div class="skeleton-thumbnail"></div>
          </div>
        </div>
      </div>

      <!-- エラー -->
      <div v-else-if="errorMessage" class="error-state">
        <p class="error-message">{{ errorMessage }}</p>
        <button class="retry-button" @click="reload">
          再試行
        </button>
      </div>

      <!-- 空状態 -->
      <div v-else-if="videos.length === 0" class="empty-state">
        <p class="empty-message">動画がありません</p>
        <p class="empty-hint">Mux にアップロードされた動画がここに表示されます</p>
      </div>

      <!-- 動画グリッド -->
      <div v-else class="video-grid">
        <VideoCard
          v-for="video in videos"
          :key="video.assetId"
          :video="video"
          :is-selected="selectedVideo?.assetId === video.assetId"
          @select="handleSelect"
          @contextmenu="handleContextMenu"
        />
      </div>
    </main>
  </div>
</template>

<style scoped>
.library-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.library-content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

/* ローディング */
.loading-state,
.loading-grid {
  display: contents;
}

.loading-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}

.skeleton-card {
  background: var(--color-surface);
  border-radius: 6px;
  overflow: hidden;
}

.skeleton-thumbnail {
  aspect-ratio: 16 / 9;
  background: linear-gradient(90deg, var(--color-surface-dark) 25%, var(--color-surface) 50%, var(--color-surface-dark) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* エラー */
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  gap: 1rem;
}

.error-message {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-error);
}

.retry-button {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: white;
  background: var(--color-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-button:hover {
  background: var(--color-primary-hover);
}

/* 空状態 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  gap: 0.5rem;
}

.empty-message {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text);
}

.empty-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* 動画グリッド */
.video-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}
</style>
