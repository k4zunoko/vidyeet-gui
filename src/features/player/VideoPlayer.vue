<script setup lang="ts">
/**
 * 動画プレイヤー
 *
 * HLS.js を使用して動画を再生
 * @see docs/UI_SPEC.md - 再生（Player）
 */
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import Hls from 'hls.js';
import type { VideoItem } from '../../types/app';
import { getHlsUrl } from '../../utils/muxUrls';

const props = defineProps<{
  video: VideoItem | null;
}>();

// video要素への参照
const videoRef = ref<HTMLVideoElement | null>(null);

// HLSインスタンス
let hls: Hls | null = null;

// 再生状態
const playerState = ref<'idle' | 'loading' | 'ready' | 'playing' | 'error'>('idle');
const errorMessage = ref<string | null>(null);

/**
 * HLSを初期化して再生開始
 */
function initPlayer(playbackId: string) {
  if (!videoRef.value) return;

  // 既存のインスタンスを破棄
  destroyPlayer();

  const hlsUrl = getHlsUrl(playbackId);
  playerState.value = 'loading';
  errorMessage.value = null;

  // HLS.js がサポートされている場合
  if (Hls.isSupported()) {
    hls = new Hls({
      // プロキシ環境での安定性向上
      enableWorker: true,
      lowLatencyMode: false,
    });

    hls.loadSource(hlsUrl);
    hls.attachMedia(videoRef.value);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      playerState.value = 'ready';
      videoRef.value?.play().catch(() => {
        // 自動再生がブロックされた場合は無視
      });
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        playerState.value = 'error';
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            errorMessage.value = 'ネットワークエラーが発生しました。接続を確認してください。';
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            errorMessage.value = 'メディアエラーが発生しました。別の動画を試してください。';
            break;
          default:
            errorMessage.value = '再生エラーが発生しました。';
        }
      }
    });
  }
  // ネイティブHLSサポート（Safari）
  else if (videoRef.value.canPlayType('application/vnd.apple.mpegurl')) {
    videoRef.value.src = hlsUrl;
    videoRef.value.addEventListener('loadedmetadata', () => {
      playerState.value = 'ready';
      videoRef.value?.play().catch(() => {});
    });
    videoRef.value.addEventListener('error', () => {
      playerState.value = 'error';
      errorMessage.value = '再生エラーが発生しました。';
    });
  }
  // HLS非対応
  else {
    playerState.value = 'error';
    errorMessage.value = 'このブラウザはHLS再生に対応していません。';
  }
}

/**
 * プレイヤーを破棄
 */
function destroyPlayer() {
  if (hls) {
    hls.destroy();
    hls = null;
  }
  if (videoRef.value) {
    videoRef.value.pause();
    videoRef.value.src = '';
  }
  playerState.value = 'idle';
  errorMessage.value = null;
}

/**
 * 再試行
 */
function handleRetry() {
  if (props.video?.playbackId) {
    initPlayer(props.video.playbackId);
  }
}

// 動画切り替えを監視
watch(
  () => props.video,
  async (newVideo) => {
    if (newVideo?.playbackId) {
      // v-if による DOM 更新を待ってから初期化
      await nextTick();
      if (videoRef.value) {
        initPlayer(newVideo.playbackId);
      }
    } else {
      destroyPlayer();
    }
  }
);

// 再生状態を監視
function handlePlay() {
  playerState.value = 'playing';
}

function handlePause() {
  if (playerState.value === 'playing') {
    playerState.value = 'ready';
  }
}

onMounted(() => {
  // 初期化はwatchで行う（props.videoが変更されたときに発火）
});

onUnmounted(() => {
  destroyPlayer();
});
</script>

<template>
  <div class="player-container">
    <!-- 未選択状態 -->
    <div v-if="!video" class="player-empty">
      <p class="empty-message">動画を選択してください</p>
    </div>

    <!-- プレイヤー本体 -->
    <div v-else class="player-wrapper">
      <!-- ローディング -->
      <div v-if="playerState === 'loading'" class="player-overlay">
        <div class="loading-spinner"></div>
        <p class="loading-text">読み込み中...</p>
      </div>

      <!-- エラー -->
      <div v-if="playerState === 'error'" class="player-overlay error">
        <p class="error-message">{{ errorMessage }}</p>
        <button class="retry-button" @click="handleRetry">
          再試行
        </button>
      </div>

      <!-- Video要素 -->
      <video
        ref="videoRef"
        class="video-element"
        controls
        playsinline
        @play="handlePlay"
        @pause="handlePause"
      ></video>
    </div>
  </div>
</template>

<style scoped>
.player-container {
  width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.player-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 9;
  background: var(--color-surface-dark);
}

.empty-message {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.player-wrapper {
  position: relative;
  aspect-ratio: 16 / 9;
}

.video-element {
  width: 100%;
  height: 100%;
  background: #000;
}

.player-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: rgba(0, 0, 0, 0.8);
  z-index: 10;
}

.player-overlay.error {
  background: rgba(0, 0, 0, 0.9);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-surface);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.error-message {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-error);
  text-align: center;
  padding: 0 1rem;
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
</style>
