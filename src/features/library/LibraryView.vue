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
  /** ログアウト要求 */
  logout: [];
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
 * 再読み込み
 */
function handleReload() {
  fetchVideos();
}

/**
 * ログアウト
 */
async function handleLogout() {
  try {
    await window.vidyeet.logout();
  } catch {
    // ログアウト失敗しても画面遷移はする
  }
  emit('logout');
}

onMounted(() => {
  fetchVideos();
});
</script>

<template>
  <div class="library-container">
    <!-- ヘッダー -->
    <header class="library-header">
      <h1 class="library-title">ライブラリ</h1>
      <div class="header-actions">
        <button class="icon-button" title="再読み込み" @click="handleReload" :disabled="isLoading">
          🔄
        </button>
        <button class="text-button" @click="handleLogout">
          ログアウト
        </button>
      </div>
    </header>

    <!-- コンテンツ -->
    <main class="library-content">
      <!-- ローディング -->
      <div v-if="isLoading" class="loading-state">
        <div class="loading-grid">
          <div v-for="i in 6" :key="i" class="skeleton-card">
            <div class="skeleton-thumbnail"></div>
            <div class="skeleton-footer"></div>
          </div>
        </div>
      </div>

      <!-- エラー -->
      <div v-else-if="errorMessage" class="error-state">
        <p class="error-message">{{ errorMessage }}</p>
        <button class="retry-button" @click="handleReload">
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

.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.library-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.icon-button {
  padding: 0.5rem;
  font-size: 1rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.icon-button:hover:not(:disabled) {
  background: var(--color-surface-hover);
}

.icon-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.text-button {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.text-button:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.library-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

/* ローディング */
.loading-state,
.loading-grid {
  display: contents;
}

.loading-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}

.skeleton-card {
  background: var(--color-surface);
  border-radius: 8px;
  overflow: hidden;
}

.skeleton-thumbnail {
  aspect-ratio: 16 / 9;
  background: linear-gradient(90deg, var(--color-surface-dark) 25%, var(--color-surface) 50%, var(--color-surface-dark) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton-footer {
  height: 2rem;
  margin: 0.5rem;
  background: var(--color-surface-dark);
  border-radius: 4px;
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
  color: var(--color-error);
}

.retry-button {
  padding: 0.625rem 1.25rem;
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
  font-size: 1rem;
  color: var(--color-text);
}

.empty-hint {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

/* 動画グリッド */
.video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
}
</style>
