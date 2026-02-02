<script setup lang="ts">
/**
 * 動画プレイヤー
 *
 * HLS.js を使用して動画を再生
 * @see docs/UI_SPEC.md - 再生（Player）
 */
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import Hls from 'hls.js';
import type { VideoItem } from '../../types/app';
import { getHlsUrl } from '../../utils/muxUrls';

const { t } = useI18n();

const props = defineProps<{
  video: VideoItem | null;
}>();

const emit = defineEmits<{
  /** 右クリックメニュー表示要求 */
  contextmenu: [event: MouseEvent, video: VideoItem];
}>();

// video要素への参照
const videoRef = ref<HTMLVideoElement | null>(null);

// HLSインスタンス
let hls: Hls | null = null;

// 現在再生中のplaybackId（変更検出・競合状態防止用）
let currentPlaybackId: string | null = null;

// 再生状態
const playerState = ref<'idle' | 'loading' | 'ready' | 'playing' | 'error'>('idle');
const errorMessage = ref<string | null>(null);

/**
 * HLSイベントハンドラを設定（初回のみ）
 */
function setupHlsEventHandlers(hlsInstance: Hls) {
  hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
    playerState.value = 'ready';
    videoRef.value?.play().catch(() => {
      // 自動再生がブロックされた場合は無視
    });
  });

  hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
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

/**
 * HLSを初期化して再生開始
 */
function initPlayer(playbackId: string) {
  if (!videoRef.value) return;

  const hlsUrl = getHlsUrl(playbackId);
  playerState.value = 'loading';
  errorMessage.value = null;

  // HLS.js がサポートされている場合
  if (Hls.isSupported()) {
    if (hls) {
      // 既存インスタンスを再利用してソース切り替え
      console.log('[VideoPlayer] Reusing HLS instance');
      hls.loadSource(hlsUrl);
      // attachMediaは既に済んでいるが、念のため呼び出し
      hls.attachMedia(videoRef.value);
    } else {
      // 新規HLSインスタンス作成
      console.log('[VideoPlayer] Creating new HLS instance');
      hls = new Hls({
        // プロキシ環境での安定性向上
        enableWorker: true,
        lowLatencyMode: false,
        // プレイヤーサイズに応じた画質自動制限（初期読み込み軽減）
        capLevelToPlayerSize: true,
        // 最大バッファ長（秒）：デフォルト30秒を維持
        maxBufferLength: 30,
        // 起動時の画質レベル：-1は自動選択（ABR）
        startLevel: -1,
      });

      setupHlsEventHandlers(hls);
      hls.loadSource(hlsUrl);
      hls.attachMedia(videoRef.value);
    }
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
 * プレイヤーを停止・リセット（インスタンスは保持）
 */
function destroyPlayer() {
  if (videoRef.value) {
    videoRef.value.pause();
    videoRef.value.src = '';
  }
  playerState.value = 'idle';
  errorMessage.value = null;
  currentPlaybackId = null;
}

/**
 * HLSインスタンスを完全破棄（onUnmounted時のみ使用）
 */
function destroyHlsInstance() {
  if (hls) {
    hls.destroy();
    hls = null;
  }
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
    const targetId = newVideo?.playbackId ?? null;

    // 同じ動画が選択された場合は再初期化をスキップ
    if (targetId === currentPlaybackId) {
      console.log('[VideoPlayer] Same video selected, skipping initialization');
      return;
    }

    // 新しいplaybackIdを記録（競合状態防止のため早期に設定）
    currentPlaybackId = targetId;

    if (targetId) {
      // v-if による DOM 更新を待ってから初期化
      await nextTick();
      // nextTick後もplaybackIdが変わっていないか確認（競合防止）
      if (currentPlaybackId === targetId && videoRef.value) {
        initPlayer(targetId);
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

/**
 * 動画要素で右クリック
 */
function handleContextMenu(event: MouseEvent) {
  if (props.video?.playbackId) {
    event.preventDefault();
    emit('contextmenu', event, props.video);
  }
}

onMounted(() => {
  // 初期化はwatchで行う（props.videoが変更されたときに発火）
});

onUnmounted(() => {
  destroyPlayer();
  destroyHlsInstance();
});
</script>

<template>
  <div class="player-container">
     <!-- 未選択状態 -->
     <div v-if="!video" class="player-empty">
       <div class="empty-content">
         <svg class="empty-icon" viewBox="0 0 24 24" fill="currentColor">
           <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9.5 12l4.5 3V9z"/>
         </svg>
         <p class="empty-message">{{ t('player.selectVideo') }}</p>
         <p class="empty-hint">{{ t('player.selectHint') }}</p>
       </div>
     </div>

    <!-- プレイヤー本体 -->
    <div v-else class="player-wrapper">
       <!-- ローディング -->
       <Transition name="fade">
         <div v-if="playerState === 'loading'" class="player-overlay">
           <div class="loading-spinner"></div>
           <p class="loading-text">{{ t('player.loading') }}</p>
         </div>
       </Transition>

      <!-- エラー -->
      <Transition name="fade">
        <div v-if="playerState === 'error'" class="player-overlay error">
          <svg class="error-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
          </svg>
          <p class="error-message">{{ errorMessage }}</p>
           <button class="retry-button" @click="handleRetry">
             <svg class="button-icon" viewBox="0 0 24 24" fill="currentColor">
               <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
             </svg>
             {{ t('player.retry') }}
           </button>
        </div>
      </Transition>

      <!-- Video要素 -->
      <video
        ref="videoRef"
        class="video-element"
        controls
        playsinline
        preload="metadata"
        @play="handlePlay"
        @pause="handlePause"
        @contextmenu="handleContextMenu"
      ></video>
    </div>
  </div>
</template>

<style scoped>
.player-container {
  width: 100%;
  max-width: 100%;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  /* シャドウで浮遂感を演出 */
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.3),
    0 2px 4px -1px rgba(0, 0, 0, 0.2);
}

.player-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 9;
  background: linear-gradient(145deg, var(--color-surface-dark), var(--color-surface));
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  text-align: center;
}

.empty-icon {
  width: 48px;
  height: 48px;
  color: var(--color-text-muted);
  opacity: 0.4;
}

.empty-message {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.empty-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  opacity: 0.7;
}

.player-wrapper {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #000;
}

.video-element {
  width: 100%;
  height: 100%;
  background: #000;
  /* ビデオコントロールのカスタマイズ */
  border-radius: 0;
}

/* ビデオコントロールのスタイリング（Chromium系） */
.video-element::-webkit-media-controls-panel {
  background: linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%);
}

.player-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  z-index: 10;
}

.player-overlay.error {
  background: rgba(0, 0, 0, 0.9);
}

/* フェードトランジション */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  letter-spacing: 0.025em;
}

.error-icon {
  width: 48px;
  height: 48px;
  color: var(--color-error);
  opacity: 0.9;
}

.error-message {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  text-align: center;
  padding: 0 1.5rem;
  max-width: 300px;
  line-height: 1.5;
}

.retry-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: white;
  background: var(--color-primary);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background 0.2s ease,
    transform 0.15s ease,
    box-shadow 0.2s ease;
}

.retry-button:hover {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(250, 80, 181, 0.4);
}

.retry-button:active {
  transform: translateY(0);
}

.button-icon {
  width: 18px;
  height: 18px;
}
</style>
