<script setup lang="ts">
/**
 * アプリケーションルート
 *
 * 起動時の認証チェック → 画面切り替え
 * フレームレスウィンドウ対応（カスタムタイトルバー）
 * コンテキストメニュー・削除ダイアログのグローバル管理
 * @see docs/UI_SPEC.md - 起動時状態遷移
 */
import { ref, onMounted, onBeforeUnmount } from "vue";
import type { AppScreen, VideoItem } from "./types/app";
import { useI18n } from "vue-i18n";
import { isIpcError } from "../electron/types/ipc";
import { useToast } from "./composables/useToast";
import { useContextMenu } from "./composables/useContextMenu";

import { useDragDrop } from "./composables/useDragDrop";
import { type FileWithPath } from "./composables/useUploadDialog";
import TitleBar from "./components/TitleBar.vue";
import SettingsView from "./features/settings/SettingsView.vue";
import VideoInfoPanel from "./components/VideoInfoPanel.vue";
import VideoContextMenu from "./components/VideoContextMenu.vue";
import ToastNotification from "./components/ToastNotification.vue";
import DragDropOverlay from "./components/DragDropOverlay.vue";
import LoginView from "./features/auth/LoginView.vue";
import LibraryView from "./features/library/LibraryView.vue";
import VideoPlayer from "./features/player/VideoPlayer.vue";
import UploadDialog from "./features/upload/UploadDialog.vue";
import DeleteConfirmDialog from "./features/delete/DeleteConfirmDialog.vue";



// 現在の画面
const currentScreen = ref<AppScreen>("initializing");

// 選択中の動画
const selectedVideo = ref<VideoItem | null>(null);

// 初期化エラー
const initError = ref<string | null>(null);

// 設定モーダル表示状態
const isSettingsOpen = ref(false);

// LibraryViewへの参照（reload用）
const libraryRef = ref<InstanceType<typeof LibraryView> | null>(null);

// ウィンドウ最小化時のリスナークリーンアップ関数
const unsubscribeWindowHidden = ref<(() => void) | null>(null);

// i18n
const { t } = useI18n();

// =============================================================================
// コンテキストメニュー状態（グローバル管理）
// =============================================================================
const contextMenu = useContextMenu();

// =============================================================================
// トースト通知
// =============================================================================
const { toasts, showToast, removeToast } = useToast();

// =============================================================================
// ドラッグアンドドロップ受け取り用ファイル一覧（UploadDialog に渡す）
// =============================================================================
const droppedFiles = ref<FileWithPath[]>([]);

// =============================================================================
// ドラッグアンドドロップ
// =============================================================================
const dragDrop = useDragDrop({
  onFilesDropped: async (files) => {
    droppedFiles.value = files.map((f) => ({
      name: f.fileName,
      path: f.filePath,
    } as FileWithPath));
  },
  showToast,
});

// =============================================================================
// 削除確認ダイアログ状態
// =============================================================================
const isDeleteOpen = ref(false);
const videoToDelete = ref<VideoItem | null>(null);



/**
 * キーボード入力ハンドラー
 * ESC キーで動画選択を解除
 */
function handleKeydown(event: KeyboardEvent) {
  // Escape キー以外は無視
  if (event.key !== 'Escape') return;

  // 入力フィールドではの入力を無視
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  ) {
    return;
  }

  // 設定モーダルが開いている場合は無視
  if (isSettingsOpen.value) {
    return;
  }

  // 動画が選択されていない場合は無視
  if (selectedVideo.value === null) {
    return;
  }

  // 選択を解除
  selectedVideo.value = null;
}

/**
 * 認証状態をチェック
 */
async function checkAuth() {
    currentScreen.value = "initializing";
    initError.value = null;

    try {
        const result = await window.vidyeet.status();

        if (isIpcError(result)) {
            // CLI エラー: ログイン画面へ（CLI未設定の可能性）
            initError.value = result.message;
            currentScreen.value = "login";
            return;
        }

        if (result.isAuthenticated) {
            currentScreen.value = "library";
            // 認証成功後にアップデート通知をチェック
            await showUpdateToastIfNeeded();
        } else {
            currentScreen.value = "login";
        }
     } catch (err) {
         initError.value = t('app.initializationError');
         currentScreen.value = "login";
     }
}

/**
 * アップデート通知を表示（必要な場合のみ）
 */
async function showUpdateToastIfNeeded() {
  // 開発モードでは通知を表示しない
  if (import.meta.env.DEV) {
    return;
  }

  try {
    const status = await window.app.getUpdateStatus();

    if (!status.shouldShowUpdateToast) {
      return;
    }

    const appInfo = await window.app.getVersion();
    showToast("info", t('app.toasts.updated', { version: appInfo.version }));

    // フラグをクリア
    await window.app.clearUpdateToast();
  } catch (error) {
    // エラー時は通知を表示しない（ログのみ）
    console.error('[App] Failed to show update toast:', error);
  }
}

/**
 * ログイン成功時
 */
function handleLoginSuccess() {
    currentScreen.value = "library";
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
    currentScreen.value = "login";
    isSettingsOpen.value = false;
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
 * 設定画面を開く
 */
function openSettings() {
    isSettingsOpen.value = true;
}

/**
 * 設定画面を閉じる
 */
function closeSettings() {
    isSettingsOpen.value = false;
}

// =============================================================================
// アップロード操作
// =============================================================================

/**
 * アップロードを開始
 */
async function handleUpload() {
    // ファイル選択ダイアログを表示
    const selectResult = await window.vidyeet.selectFile();

    if (isIpcError(selectResult)) {
        // エラー表示
        showToast("error", selectResult.message);
        return;
    }

    // キャンセルされた場合
    if (!selectResult.filePath) {
        return;
    }

    // ファイル名を取得
    const fileName =
        selectResult.filePath.split(/[\/]/).pop() || selectResult.filePath;

    // droppedFiles 経由で UploadDialog コンポーネントに渡す
    droppedFiles.value = [
        {
            name: fileName,
            path: selectResult.filePath,
        } as FileWithPath,
    ];
}

// =============================================================================
// コンテキストメニュー操作
// =============================================================================

/**
 * コンテキストメニューから削除を要求
 */
function handleDeleteRequest(video: VideoItem) {
    videoToDelete.value = video;
    isDeleteOpen.value = true;
}

/**
 * 削除成功時：一覧と選択状態を更新
 */
function handleVideoDeleted(videoId: string) {
    // 削除成功: 一覧から削除
    libraryRef.value?.removeVideo(videoId);

    // 選択中の動画が削除された場合、選択を解除
    if (selectedVideo.value?.assetId === videoId) {
        selectedVideo.value = null;
    }
}

/**
 * アップロード完了時：ライブラリを再読み込み
 */
function handleUploadComplete() {
    libraryRef.value?.reload();
}

/**
 * マウント時の初期化
 * - 認証チェック
 * - グローバルドラッグアンドドロップイベントの登録
 * - ESC キーリスナーの登録
 * - ウィンドウ最小化イベントの登録
 */
onMounted(() => {
    checkAuth();

    // グローバルドラッグアンドドロップイベントを登録
    dragDrop.setupGlobalListeners();

    // ESC キーハンドラを登録
    window.addEventListener('keydown', handleKeydown);

    // ウィンドウ最小化イベントハンドラを登録
    unsubscribeWindowHidden.value = window.app?.onWindowHidden?.(() => {
      if (selectedVideo.value !== null) {
        selectedVideo.value = null;
      }
    }) ?? null;
});

/**
 * アンマウント時のクリーンアップ
 */
onBeforeUnmount(() => {
    // イベントリスナーを削除
    dragDrop.cleanupGlobalListeners();

    // ESC キーハンドラを削除
    window.removeEventListener('keydown', handleKeydown);

    // ウィンドウ最小化イベントハンドラを削除
    unsubscribeWindowHidden.value?.();
});
</script>

<template>
    <div id="app">
        <!-- カスタムタイトルバー -->
        <TitleBar
            :show-reload="currentScreen === 'library'"
            :show-settings="currentScreen === 'library'"
            @reload="handleReload"
            @open-settings="openSettings"
        />

        <!-- メインコンテンツ領域（タイトルバー分の高さを引く） -->
        <div class="app-content">
            <!-- 初期化中 -->
            <div
                v-if="currentScreen === 'initializing'"
                class="initializing-screen"
            >
                <div class="initializing-content">
                    <div class="loading-spinner"></div>
                    <p class="initializing-text">{{ $t('app.initializing') }}</p>
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
                        @contextmenu="contextMenu.showContextMenu"
                        @upload="handleUpload"
                    />
                </aside>

                <!-- メインエリア: プレイヤー + 情報パネル -->
                <div class="main-area">
                    <main class="main-content">
                        <VideoPlayer
                            :video="selectedVideo"
                            @contextmenu="contextMenu.showContextMenu"
                        />
                    </main>
                    <VideoInfoPanel :video="selectedVideo" />
                </div>
            </div>

            <!-- 設定モーダル -->
            <SettingsView
                :is-open="isSettingsOpen"
                @close="closeSettings"
                @logout="handleLogout"
            />

            <!-- グローバルコンテキストメニュー -->
            <VideoContextMenu
                :is-open="contextMenu.state.value.isOpen"
                :video="contextMenu.state.value.video"
                :x="contextMenu.state.value.x"
                :y="contextMenu.state.value.y"
                @close="contextMenu.closeContextMenu"
                @delete="handleDeleteRequest"
                @copy-success="
                    () => showToast('success', $t('app.toasts.linkCopied'))
                "
            />

            <!-- 削除確認ダイアログ -->
            <DeleteConfirmDialog
                v-model="isDeleteOpen"
                :video="videoToDelete"
                @deleted="handleVideoDeleted"
            />

            <!-- アップロードダイアログ -->
            <UploadDialog
                :files="droppedFiles"
                :show-toast="showToast"
                @upload-complete="handleUploadComplete"
            />

            <!-- トースト通知 -->
            <ToastNotification :toasts="toasts" @close="removeToast" />

            <!-- ドラッグアンドドロップオーバーレイ -->
            <DragDropOverlay :is-dragging="dragDrop.isDragging.value" />
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
    to {
        transform: rotate(360deg);
    }
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
</style>
