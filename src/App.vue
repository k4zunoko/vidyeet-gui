<script setup lang="ts">
/**
 * アプリケーションルート
 *
 * 起動時の認証チェック → 画面切り替え
 * フレームレスウィンドウ対応（カスタムタイトルバー）
 * コンテキストメニュー・削除ダイアログのグローバル管理
 * @see docs/UI_SPEC.md - 起動時状態遷移
 */
import { ref, onMounted } from 'vue';
import type { AppScreen, VideoItem } from './types/app';
import type { UploadProgress } from '../electron/types/ipc';
import { isIpcError } from '../electron/types/ipc';
import TitleBar from './components/TitleBar.vue';
import SideDrawer from './components/SideDrawer.vue';
import VideoInfoPanel from './components/VideoInfoPanel.vue';
import VideoContextMenu from './components/VideoContextMenu.vue';
import LoginView from './features/auth/LoginView.vue';
import LibraryView from './features/library/LibraryView.vue';
import VideoPlayer from './features/player/VideoPlayer.vue';

// 現在の画面
const currentScreen = ref<AppScreen>('initializing');

// 選択中の動画
const selectedVideo = ref<VideoItem | null>(null);

// 初期化エラー
const initError = ref<string | null>(null);

// ドロワー表示状態
const isDrawerOpen = ref(false);

// LibraryViewへの参照（reload用）
const libraryRef = ref<InstanceType<typeof LibraryView> | null>(null);

// =============================================================================
// コンテキストメニュー状態（グローバル管理）
// =============================================================================
const contextMenuState = ref({
  isOpen: false,
  video: null as VideoItem | null,
  x: 0,
  y: 0,
});

// =============================================================================
// 削除確認ダイアログ状態
// =============================================================================
const deleteDialogState = ref({
  isOpen: false,
  video: null as VideoItem | null,
  isDeleting: false,
  errorMessage: null as string | null,
});

// =============================================================================
// アップロードダイアログ状態
// =============================================================================
const uploadDialogState = ref({
  isOpen: false,
  fileName: '',
  phase: '' as string,
  phaseText: '',
  isUploading: false,
  errorMessage: null as string | null,
});

/**
 * アップロードフェーズを日本語に変換
 */
function getPhaseText(phase: string): string {
  const phaseMap: Record<string, string> = {
    validating_file: 'ファイルを検証中...',
    file_validated: 'ファイル検証完了',
    creating_direct_upload: 'アップロード準備中...',
    direct_upload_created: 'アップロード準備完了',
    uploading_file: 'アップロード中...',
    upload_progress: 'アップロード中...',
    completed: '完了',
  };
  return phaseMap[phase] || phase;
}

/**
 * 認証状態をチェック
 */
async function checkAuth() {
  currentScreen.value = 'initializing';
  initError.value = null;

  try {
    const result = await window.vidyeet.status();

    if (isIpcError(result)) {
      // CLI エラー: ログイン画面へ（CLI未設定の可能性）
      initError.value = result.message;
      currentScreen.value = 'login';
      return;
    }

    if (result.isAuthenticated) {
      currentScreen.value = 'library';
    } else {
      currentScreen.value = 'login';
    }
  } catch (err) {
    initError.value = '初期化に失敗しました。アプリを再起動してください。';
    currentScreen.value = 'login';
  }
}

/**
 * ログイン成功時
 */
function handleLoginSuccess() {
  currentScreen.value = 'library';
}

/**
 * ログアウト時
 */
async function handleLogout() {
  try {
    await window.vidyeet.logout();
  } catch {
    // ログアウト失敗しても画面遷移はする
  }
  selectedVideo.value = null;
  currentScreen.value = 'login';
  isDrawerOpen.value = false;
}

/**
 * 動画選択時
 */
function handleSelectVideo(video: VideoItem) {
  selectedVideo.value = video;
}

/**
 * 再読み込み
 */
function handleReload() {
  libraryRef.value?.reload();
}

/**
 * メニュー開閉
 */
function toggleDrawer() {
  isDrawerOpen.value = !isDrawerOpen.value;
}

/**
 * ドロワーを閉じる
 */
function closeDrawer() {
  isDrawerOpen.value = false;
}

// =============================================================================
// アップロード操作
// =============================================================================

/**
 * アップロードを開始
 */
async function handleUpload() {
  // ドロワーを閉じる
  isDrawerOpen.value = false;

  // ファイル選択ダイアログを表示
  const selectResult = await window.vidyeet.selectFile();

  if (isIpcError(selectResult)) {
    // エラー表示（簡易版）
    uploadDialogState.value = {
      isOpen: true,
      fileName: '',
      phase: 'error',
      phaseText: '',
      isUploading: false,
      errorMessage: selectResult.message,
    };
    return;
  }

  // キャンセルされた場合
  if (!selectResult.filePath) {
    return;
  }

  // ファイル名を取得
  const fileName = selectResult.filePath.split(/[\\/]/).pop() || selectResult.filePath;

  // アップロードダイアログを表示
  uploadDialogState.value = {
    isOpen: true,
    fileName,
    phase: 'starting',
    phaseText: '開始中...',
    isUploading: true,
    errorMessage: null,
  };

  // アップロード実行
  const uploadResult = await window.vidyeet.upload(
    { filePath: selectResult.filePath },
    (progress: UploadProgress) => {
      // 進捗更新
      uploadDialogState.value.phase = progress.phase;
      uploadDialogState.value.phaseText = getPhaseText(progress.phase);
    }
  );

  if (isIpcError(uploadResult)) {
    uploadDialogState.value.isUploading = false;
    uploadDialogState.value.errorMessage = uploadResult.message;
    return;
  }

  // 成功
  uploadDialogState.value.phase = 'completed';
  uploadDialogState.value.phaseText = 'アップロード完了！';
  uploadDialogState.value.isUploading = false;

  // 一覧を再読み込み
  libraryRef.value?.reload();

  // 少し待ってからダイアログを閉じる
  setTimeout(() => {
    uploadDialogState.value.isOpen = false;
  }, 1500);
}

/**
 * アップロードダイアログを閉じる
 */
function closeUploadDialog() {
  if (!uploadDialogState.value.isUploading) {
    uploadDialogState.value.isOpen = false;
  }
}

// =============================================================================
// コンテキストメニュー操作
// =============================================================================

/**
 * コンテキストメニューを表示（サイドバーまたはプレイヤーから）
 */
function showContextMenu(event: MouseEvent, video: VideoItem) {
  contextMenuState.value = {
    isOpen: true,
    video,
    x: event.clientX,
    y: event.clientY,
  };
}

/**
 * コンテキストメニューを閉じる
 */
function closeContextMenu() {
  contextMenuState.value.isOpen = false;
}

/**
 * コンテキストメニューから削除を要求
 */
function handleDeleteRequest(video: VideoItem) {
  deleteDialogState.value = {
    isOpen: true,
    video,
    isDeleting: false,
    errorMessage: null,
  };
}

// =============================================================================
// 削除ダイアログ操作
// =============================================================================

/**
 * 削除をキャンセル
 */
function cancelDelete() {
  deleteDialogState.value.isOpen = false;
  deleteDialogState.value.video = null;
}

/**
 * 削除を実行
 */
async function confirmDelete() {
  const video = deleteDialogState.value.video;
  if (!video) return;

  deleteDialogState.value.isDeleting = true;
  deleteDialogState.value.errorMessage = null;

  try {
    const result = await window.vidyeet.delete({ assetId: video.assetId });

    if (isIpcError(result)) {
      deleteDialogState.value.errorMessage = '動画の削除に失敗しました。';
      deleteDialogState.value.isDeleting = false;
      return;
    }

    // 削除成功: 一覧から削除
    libraryRef.value?.removeVideo(video.assetId);

    // 選択中の動画が削除された場合、選択を解除
    if (selectedVideo.value?.assetId === video.assetId) {
      selectedVideo.value = null;
    }

    // ダイアログを閉じる
    deleteDialogState.value.isOpen = false;
    deleteDialogState.value.video = null;
  } catch (err) {
    deleteDialogState.value.errorMessage = '削除中にエラーが発生しました。';
  } finally {
    deleteDialogState.value.isDeleting = false;
  }
}

/**
 * プレイヤーエリアで右クリック
 */
function handlePlayerContextMenu(event: MouseEvent) {
  if (selectedVideo.value?.playbackId) {
    event.preventDefault();
    showContextMenu(event, selectedVideo.value);
  }
}

onMounted(() => {
  checkAuth();
});
</script>

<template>
  <div id="app">
    <!-- カスタムタイトルバー -->
    <TitleBar
      :show-reload="currentScreen === 'library'"
      :show-menu="currentScreen === 'library'"
      @reload="handleReload"
      @toggle-menu="toggleDrawer"
    />

    <!-- メインコンテンツ領域（タイトルバー分の高さを引く） -->
    <div class="app-content">
      <!-- 初期化中 -->
      <div v-if="currentScreen === 'initializing'" class="initializing-screen">
        <div class="initializing-content">
          <div class="loading-spinner"></div>
          <p class="initializing-text">起動中...</p>
        </div>
      </div>

      <!-- ログイン画面 -->
      <LoginView
        v-else-if="currentScreen === 'login'"
        @success="handleLoginSuccess"
      />

      <!-- ライブラリ画面 -->
      <div v-else-if="currentScreen === 'library'" class="main-layout">
        <!-- サイドバー: 動画一覧 -->
        <aside class="sidebar">
          <LibraryView
            ref="libraryRef"
            :selected-video="selectedVideo"
            @select="handleSelectVideo"
            @contextmenu="showContextMenu"
          />
        </aside>

        <!-- メインエリア: プレイヤー + 情報パネル -->
        <div class="main-area">
          <main class="main-content" @contextmenu="handlePlayerContextMenu">
            <VideoPlayer :video="selectedVideo" />
          </main>
          <VideoInfoPanel :video="selectedVideo" />
        </div>
      </div>

      <!-- ドロワー -->
      <SideDrawer
        :is-open="isDrawerOpen"
        @close="closeDrawer"
        @upload="handleUpload"
        @logout="handleLogout"
      />

      <!-- グローバルコンテキストメニュー -->
      <VideoContextMenu
        :is-open="contextMenuState.isOpen"
        :video="contextMenuState.video"
        :x="contextMenuState.x"
        :y="contextMenuState.y"
        @close="closeContextMenu"
        @delete="handleDeleteRequest"
      />

      <!-- 削除確認ダイアログ -->
      <Teleport to="body">
        <Transition name="dialog">
          <div
            v-if="deleteDialogState.isOpen"
            class="dialog-overlay"
            @click.self="cancelDelete"
          >
            <div class="delete-dialog" role="alertdialog" aria-labelledby="delete-dialog-title">
              <h2 id="delete-dialog-title" class="dialog-title">動画を削除しますか？</h2>
              <p class="dialog-message">
                この操作は取り消せません。Muxから完全に削除されます。
              </p>
              <p v-if="deleteDialogState.errorMessage" class="dialog-error">
                {{ deleteDialogState.errorMessage }}
              </p>
              <div class="dialog-actions">
                <button
                  class="dialog-button dialog-button--cancel"
                  @click="cancelDelete"
                  :disabled="deleteDialogState.isDeleting"
                >
                  キャンセル
                </button>
                <button
                  class="dialog-button dialog-button--danger"
                  @click="confirmDelete"
                  :disabled="deleteDialogState.isDeleting"
                >
                  {{ deleteDialogState.isDeleting ? '削除中...' : '削除する' }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- アップロードダイアログ -->
      <Teleport to="body">
        <Transition name="dialog">
          <div
            v-if="uploadDialogState.isOpen"
            class="dialog-overlay"
            @click.self="closeUploadDialog"
          >
            <div class="upload-dialog" role="dialog" aria-labelledby="upload-dialog-title">
              <h2 id="upload-dialog-title" class="dialog-title">
                {{ uploadDialogState.errorMessage ? 'アップロードエラー' : 'アップロード中' }}
              </h2>
              
              <!-- エラー表示 -->
              <template v-if="uploadDialogState.errorMessage">
                <p class="dialog-error">{{ uploadDialogState.errorMessage }}</p>
                <div class="dialog-actions">
                  <button
                    class="dialog-button dialog-button--cancel"
                    @click="closeUploadDialog"
                  >
                    閉じる
                  </button>
                </div>
              </template>

              <!-- 進捗表示 -->
              <template v-else>
                <p class="upload-filename">{{ uploadDialogState.fileName }}</p>
                <div class="upload-progress">
                  <div class="upload-spinner" v-if="uploadDialogState.isUploading"></div>
                  <span 
                    class="upload-phase"
                    :class="{ 'upload-phase--complete': uploadDialogState.phase === 'completed' }"
                  >
                    {{ uploadDialogState.phaseText }}
                  </span>
                </div>
              </template>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>
  </div>
</template>

<style scoped>
#app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app-content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* 初期化中 */
.initializing-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: var(--color-bg);
}

.initializing-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
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

.initializing-text {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

/* メインレイアウト（Library画面） */
.main-layout {
  display: flex;
  height: 100%;
}

.sidebar {
  width: 240px;
  min-width: 200px;
  max-width: 320px;
  height: 100%;
  border-right: 1px solid var(--color-border);
  overflow: hidden;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: var(--color-bg);
  overflow: auto;
}

/* ======================================
   削除確認ダイアログ
   ====================================== */
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.15s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-active .delete-dialog,
.dialog-leave-active .delete-dialog {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease;
}

.dialog-enter-from .delete-dialog,
.dialog-leave-to .delete-dialog {
  opacity: 0;
  transform: scale(0.95) translateY(-8px);
}

.delete-dialog {
  width: 90%;
  max-width: 360px;
  padding: 1.5rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
}

.dialog-title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.dialog-message {
  margin: 0 0 1.25rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.dialog-error {
  margin: 0 0 1rem;
  font-size: 0.8125rem;
  color: var(--color-error, #ef4444);
}

.dialog-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.dialog-button {
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
  /* Fitts' Law: 十分なタッチターゲット */
  min-height: 36px;
  min-width: 80px;
}

.dialog-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dialog-button--cancel {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

.dialog-button--cancel:hover:not(:disabled) {
  background: var(--color-surface-dark);
}

.dialog-button--danger {
  color: white;
  background: var(--color-error, #ef4444);
}

.dialog-button--danger:hover:not(:disabled) {
  background: #dc2626;
}

/* Upload Dialog */
.upload-dialog {
  background: var(--color-surface);
  border-radius: 12px;
  padding: 1.5rem;
  min-width: 340px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.upload-filename {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-bottom: 1rem;
  word-break: break-all;
  text-align: center;
}

.upload-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
}

.upload-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.upload-phase {
  font-size: 0.875rem;
  color: var(--color-text);
}

.upload-phase--complete {
  color: var(--color-success, #22c55e);
  font-weight: 500;
}
</style>

