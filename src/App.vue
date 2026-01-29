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
import { isIpcError } from "../electron/types/ipc";
import { useToast } from "./composables/useToast";
import { useContextMenu } from "./composables/useContextMenu";
import { useDeleteDialog } from "./composables/useDeleteDialog";
import { useDragDrop } from "./composables/useDragDrop";
import { useUploadDialog } from "./composables/useUploadDialog";
import TitleBar from "./components/TitleBar.vue";
import SettingsModal from "./components/SettingsModal.vue";
import VideoInfoPanel from "./components/VideoInfoPanel.vue";
import VideoContextMenu from "./components/VideoContextMenu.vue";
import ToastNotification from "./components/ToastNotification.vue";
import DragDropOverlay from "./components/DragDropOverlay.vue";
import LoginView from "./features/auth/LoginView.vue";
import LibraryView from "./features/library/LibraryView.vue";
import VideoPlayer from "./features/player/VideoPlayer.vue";

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

// =============================================================================
// コンテキストメニュー状態（グローバル管理）
// =============================================================================
const contextMenu = useContextMenu();

// =============================================================================
// トースト通知
// =============================================================================
const { toasts, showToast, removeToast } = useToast();

// =============================================================================
// アップロードダイアログ
// =============================================================================
const uploadDialog = useUploadDialog({
  showToast,
  onUploadComplete: () => {
    libraryRef.value?.reload();
  },
});

// =============================================================================
// ドラッグアンドドロップ
// =============================================================================
const dragDrop = useDragDrop({
  onFilesDropped: async (files) => {
    await uploadDialog.handleMultipleFiles(
      files.map((f) => ({
        name: f.fileName,
        path: f.filePath,
      } as any)),
    );
  },
  showToast,
});

// =============================================================================
// 削除確認ダイアログ状態
// =============================================================================
const deleteDialog = useDeleteDialog({
  onDelete: async (assetId: string) => {
    const result = await window.vidyeet.delete({ assetId });
    if (isIpcError(result)) {
      throw new Error("動画の削除に失敗しました。");
    }
  },
  onDeleted: (assetId: string) => {
    // 削除成功: 一覧から削除
    libraryRef.value?.removeVideo(assetId);

    // 選択中の動画が削除された場合、選択を解除
    if (selectedVideo.value?.assetId === assetId) {
      selectedVideo.value = null;
    }
  },
  showToast,
});



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
        } else {
            currentScreen.value = "login";
        }
    } catch (err) {
        initError.value = "初期化に失敗しました。アプリを再起動してください。";
        currentScreen.value = "login";
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
        selectResult.filePath.split(/[\\/]/).pop() || selectResult.filePath;

    // handleMultipleFiles を使ってキューに追加＆処理開始
    await uploadDialog.handleMultipleFiles([
        {
            name: fileName,
            path: selectResult.filePath,
        } as any,
    ]);
}

// =============================================================================
// コンテキストメニュー操作
// =============================================================================

/**
 * コンテキストメニューから削除を要求
 */
function handleDeleteRequest(video: VideoItem) {
    deleteDialog.openDeleteDialog(video);
}

/**
 * マウント時の初期化
 * - 認証チェック
 * - グローバルドラッグアンドドロップイベントの登録
 */
onMounted(() => {
    checkAuth();

    // グローバルドラッグアンドドロップイベントを登録
    dragDrop.setupGlobalListeners();
});

/**
 * アンマウント時のクリーンアップ
 */
onBeforeUnmount(() => {
    // イベントリスナーを削除
    dragDrop.cleanupGlobalListeners();
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
            <SettingsModal
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
                    () => showToast('success', 'リンクをコピーしました')
                "
            />

            <!-- 削除確認ダイアログ -->
            <Teleport to="body">
                <Transition name="dialog">
                    <div
                        v-if="deleteDialog.state.value.isOpen"
                        class="dialog-overlay"
                        @click.self="deleteDialog.cancelDelete"
                    >
                        <div
                            class="delete-dialog"
                            role="alertdialog"
                            aria-labelledby="delete-dialog-title"
                        >
                            <h2 id="delete-dialog-title" class="dialog-title">
                                動画を削除しますか？
                            </h2>
                            <p class="dialog-message">
                                この操作は取り消せません。Muxから完全に削除されます。
                            </p>
                            <p
                                v-if="deleteDialog.state.value.errorMessage"
                                class="dialog-error"
                            >
                                {{ deleteDialog.state.value.errorMessage }}
                            </p>
                            <div class="dialog-actions">
                                <button
                                    class="dialog-button dialog-button--cancel"
                                    @click="deleteDialog.cancelDelete"
                                    :disabled="deleteDialog.state.value.isDeleting"
                                >
                                    キャンセル
                                </button>
                                <button
                                    class="dialog-button dialog-button--danger"
                                    @click="deleteDialog.confirmDelete"
                                    :disabled="deleteDialog.state.value.isDeleting"
                                >
                                    {{
                                        deleteDialog.state.value.isDeleting
                                            ? "削除中..."
                                            : "削除する"
                                    }}
                                </button>
                            </div>
                        </div>
                    </div>
                </Transition>
            </Teleport>

            <!-- アップロードダイアログ -->
            <!-- ノンモーダル アップロード進捗ダイアログ（画面右下固定） -->
            <Teleport to="body">
                <Transition name="upload-slide">
                    <div
                        v-if="uploadDialog.uploadDialogState.value.isOpen"
                        class="upload-dialog-nonmodal"
                        :class="{
                            'upload-dialog-nonmodal--minimized':
                                uploadDialog.uploadDialogState.value.isMinimized,
                        }"
                        role="dialog"
                        aria-labelledby="upload-dialog-title"
                    >
                        <!-- 最小化状態: コンパクトバー -->
                        <!-- UX原則: エラーは目立つ視覚的指標で表示（NN/g）、視覚的階層でエラーアイコンを最も目立たせる -->
                        <div
                            v-if="uploadDialog.uploadDialogState.value.isMinimized"
                            class="upload-minimized-bar"
                            :class="{
                                'upload-minimized-bar--error':
                                    uploadDialog.uploadDialogState.value.errorMessage,
                            }"
                            @click="uploadDialog.restoreUploadDialog"
                            :title="
                                uploadDialog.uploadDialogState.value.errorMessage
                                    ? 'クリックして詳細を確認'
                                    : 'クリックして展開'
                            "
                        >
                            <!-- エラー時: エラーアイコン -->
                            <svg
                                v-if="uploadDialog.uploadDialogState.value.errorMessage"
                                class="upload-minimized-icon upload-minimized-icon--error"
                                width="20"
                                height="20"
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <circle
                                    cx="10"
                                    cy="10"
                                    r="9"
                                    stroke="currentColor"
                                    stroke-width="2"
                                />
                                <path
                                    d="M10 6V11"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                />
                                <circle
                                    cx="10"
                                    cy="14"
                                    r="1"
                                    fill="currentColor"
                                />
                            </svg>

                            <!-- 進行中: スピナー -->
                            <div
                                v-else-if="uploadDialog.uploadDialogState.value.isUploading"
                                class="upload-minimized-spinner"
                            ></div>

                            <!-- 成功時: チェックマーク（短時間表示） -->
                            <svg
                                v-else-if="
                                    uploadDialog.uploadDialogState.value.phase === 'completed'
                                "
                                class="upload-minimized-icon upload-minimized-icon--success"
                                width="20"
                                height="20"
                                viewBox="0 0 20 20"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <circle
                                    cx="10"
                                    cy="10"
                                    r="9"
                                    stroke="currentColor"
                                    stroke-width="2"
                                />
                                <path
                                    d="M6 10L8.5 12.5L14 7"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                />
                            </svg>

                            <span class="upload-minimized-text">
                                {{
                                    uploadDialog.uploadDialogState.value.errorMessage
                                        ? "アップロード失敗"
                                        : uploadDialog.uploadDialogState.value.fileName
                                }}
                            </span>

                            <!-- 進捗率: エラー時は非表示（認知負荷を減らす） -->
                            <!-- 進捗率または件数: エラー時は非表示 -->
                            <span
                                v-if="!uploadDialog.uploadDialogState.value.errorMessage"
                                class="upload-minimized-percent"
                            >
                                <template
                                    v-if="uploadDialog.uploadQueue.stats.value.total > 1"
                                >
                                    {{
                                        uploadDialog.uploadQueue.stats.value.completed +
                                        uploadDialog.uploadQueue.stats.value.uploading
                                    }}/{{ uploadDialog.uploadQueue.stats.value.total }}
                                </template>
                                <template
                                    v-else-if="uploadDialog.uploadDialogState.value.isUploading"
                                >
                                    {{ uploadDialog.uploadDialogState.value.progressPercent }}%
                                </template>
                            </span>
                        </div>

                        <!-- 通常状態: フル表示 -->
                        <div v-else class="upload-dialog-content">
                            <div class="upload-dialog-header">
                                <h2
                                    id="upload-dialog-title"
                                    class="upload-dialog-title"
                                >
                                    {{
                                        uploadDialog.uploadDialogState.value.errorMessage
                                            ? "アップロードエラー"
                                            : uploadDialog.uploadQueue.stats.value.total > 1
                                              ? `アップロード中 (${uploadDialog.uploadQueue.stats.value.completed + uploadDialog.uploadQueue.stats.value.uploading}/${uploadDialog.uploadQueue.stats.value.total})`
                                              : "アップロード中"
                                    }}
                                </h2>
                                <div class="upload-dialog-controls">
                                    <button
                                        v-if="!uploadDialog.uploadDialogState.value.errorMessage"
                                        class="upload-control-button"
                                        @click="uploadDialog.minimizeUploadDialog"
                                        aria-label="最小化"
                                        title="最小化"
                                    >
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 16 16"
                                            fill="none"
                                        >
                                            <path
                                                d="M3 8h10"
                                                stroke="currentColor"
                                                stroke-width="2"
                                                stroke-linecap="round"
                                            />
                                        </svg>
                                    </button>
                                    <button
                                        v-if="uploadDialog.uploadDialogState.value.errorMessage"
                                        class="upload-control-button"
                                        @click="uploadDialog.closeUploadDialog"
                                        aria-label="閉じる"
                                        title="閉じる"
                                    >
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 16 16"
                                            fill="none"
                                        >
                                            <path
                                                d="M4 4l8 8M12 4l-8 8"
                                                stroke="currentColor"
                                                stroke-width="2"
                                                stroke-linecap="round"
                                            />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <!-- 現在のファイル: エラー表示 -->
                            <template v-if="uploadDialog.uploadDialogState.value.errorMessage">
                                <p class="upload-error-message">
                                    {{ uploadDialog.uploadDialogState.value.errorMessage }}
                                </p>
                            </template>

                            <!-- 現在のファイル: 進捗表示 -->
                            <template v-else>
                                <p class="upload-filename">
                                    {{ uploadDialog.uploadDialogState.value.fileName }}
                                </p>

                                <!-- プログレスバー表示 (uploading_chunk フェーズ時) -->
                                <!-- UX原則: percent-done indicator は10秒以上の処理に効果的 (NN/g) -->
                                <div
                                    v-if="uploadDialog.uploadDialogState.value.showProgressBar"
                                    class="upload-progress-bar-container"
                                >
                                    <div class="upload-progress-bar-track">
                                        <div
                                            class="upload-progress-bar-fill"
                                            :class="{
                                                'upload-progress-bar-fill--complete':
                                                    uploadDialog.uploadDialogState.value.progressPercent >=
                                                    100,
                                            }"
                                            :style="{
                                                width: `${uploadDialog.uploadDialogState.value.progressPercent}%`,
                                            }"
                                        ></div>
                                    </div>
                                    <div class="upload-progress-info">
                                        <span class="upload-progress-percent"
                                            >{{
                                                uploadDialog.uploadDialogState.value.progressPercent
                                            }}%</span
                                        >
                                        <span class="upload-progress-bytes">
                                            {{
                                                uploadDialog.formatBytes(
                                                    uploadDialog.uploadDialogState.value.bytesSent,
                                                )
                                            }}
                                            /
                                            {{
                                                uploadDialog.formatBytes(
                                                    uploadDialog.uploadDialogState.value.totalBytes,
                                                )
                                            }}
                                        </span>
                                    </div>
                                </div>

                                <!-- スピナー表示 (プログレスバーが無い時) -->
                                <div v-else class="upload-progress">
                                    <div
                                        class="upload-spinner"
                                        v-if="uploadDialog.uploadDialogState.value.isUploading"
                                    ></div>
                                    <span
                                        class="upload-phase"
                                        :class="{
                                            'upload-phase--complete':
                                                uploadDialog.uploadDialogState.value.phase ===
                                                'completed',
                                        }"
                                    >
                                        {{ uploadDialog.uploadDialogState.value.phaseText }}
                                    </span>
                                </div>

                                <!-- フェーズテキスト (プログレスバー表示時も表示) -->
                                <p
                                    v-if="uploadDialog.uploadDialogState.value.showProgressBar"
                                    class="upload-phase-text"
                                >
                                    {{ uploadDialog.uploadDialogState.value.phaseText }}
                                </p>
                            </template>

                            <!-- キュー表示 -->
                            <div
                                v-if="uploadDialog.uploadQueue.items.value.length > 1"
                                class="upload-queue"
                            >
                                <div class="upload-queue-header">
                                    <span class="upload-queue-title"
                                        >待機中 ({{
                                            uploadDialog.uploadQueue.stats.value.waiting
                                        }}件)</span
                                    >
                                </div>
                                <div class="upload-queue-list">
                                    <div
                                        v-for="item in uploadDialog.uploadQueue.items.value.filter(
                                            (i) => i.status === 'waiting',
                                        )"
                                        :key="item.id"
                                        class="upload-queue-item"
                                    >
                                        <span class="upload-queue-filename">{{
                                            item.fileName
                                        }}</span>
                                        <button
                                            class="upload-queue-cancel"
                                            @click="uploadDialog.cancelQueueItem(item.id)"
                                            aria-label="キャンセル"
                                            title="キャンセル"
                                        >
                                            <svg
                                                width="12"
                                                height="12"
                                                viewBox="0 0 12 12"
                                                fill="none"
                                            >
                                                <path
                                                    d="M3 3l6 6M9 3l-6 6"
                                                    stroke="currentColor"
                                                    stroke-width="1.5"
                                                    stroke-linecap="round"
                                                />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </Transition>
            </Teleport>

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

/* ======================================
   削除確認ダイアログ
   ====================================== */
/* モーダルダイアログ（削除確認など）用のオーバーレイ */
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
    transition:
        transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
        opacity 0.15s ease;
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
    transition:
        background 0.15s ease,
        opacity 0.15s ease;
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

/* ノンモーダル アップロード進捗ダイアログ */
/* UX原則: 長時間処理はノンモーダルで、ユーザーに制御を与える (NN/g) */
.upload-dialog-nonmodal {
    position: fixed;
    right: 1.5rem;
    bottom: 1.5rem;
    z-index: 1000; /* タイトルバー(9000)より低く、他のコンテンツより高い */
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    min-width: 360px;
    max-width: 90vw;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.upload-dialog-nonmodal--minimized {
    min-width: 280px;
}

.upload-dialog-content {
    padding: 1.5rem;
}

.upload-dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
}

.upload-dialog-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
}

.upload-dialog-controls {
    display: flex;
    gap: 0.5rem;
}

.upload-control-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
}

.upload-control-button:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
}

.upload-control-button:active {
    transform: scale(0.95);
}

/* 最小化状態のコンパクトバー */
/* UX原則: 視覚的階層でエラーを明確に伝える、認知負荷を最小限にする */
.upload-minimized-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 12px;
}

.upload-minimized-bar:hover {
    background: var(--color-surface-hover);
}

/* エラー状態: 赤系の背景で即座に認識可能（視認性） */
.upload-minimized-bar--error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid var(--color-error, #ef4444);
}

.upload-minimized-bar--error:hover {
    background: rgba(239, 68, 68, 0.15);
}

.upload-minimized-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
}

/* アイコン共通スタイル */
.upload-minimized-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
}

/* エラーアイコン: 赤色で警告を明確に */
.upload-minimized-icon--error {
    color: var(--color-error, #ef4444);
}

/* 成功アイコン: 緑色で達成感を演出（ピーク・エンド） */
.upload-minimized-icon--success {
    color: var(--color-success, #22c55e);
}

.upload-minimized-text {
    flex: 1;
    font-size: 0.8125rem;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* エラー時のテキストも赤色に */
.upload-minimized-bar--error .upload-minimized-text {
    color: var(--color-error, #ef4444);
    font-weight: 500;
}

.upload-minimized-percent {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-primary);
    flex-shrink: 0;
}

/* スライドインアニメーション */
.upload-slide-enter-active,
.upload-slide-leave-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.upload-slide-enter-from,
.upload-slide-leave-to {
    opacity: 0;
    transform: translateY(2rem);
}

.upload-error-message {
    margin: 0 0 1rem;
    padding: 0.75rem;
    font-size: 0.8125rem;
    color: var(--color-error, #ef4444);
    background: rgba(239, 68, 68, 0.1);
    border-radius: 6px;
    line-height: 1.5;
}

.upload-filename {
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin-bottom: 1rem;
    word-break: break-all;
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

/* プログレスバー
 * UX原則:
 * - 視覚的階層: バーが主役、数値は補助
 * - ドハティの閾値: スムーズなアニメーションで待ち時間を軽減
 * - ピーク・エンド: 完了時の色変化で達成感を演出
 */
.upload-progress-bar-container {
    padding: 0.5rem 0;
}

.upload-progress-bar-track {
    width: 100%;
    height: 8px;
    background: var(--color-border);
    border-radius: 4px;
    overflow: hidden;
    /* 視覚的な深み */
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.upload-progress-bar-fill {
    height: 100%;
    background: linear-gradient(
        90deg,
        var(--color-primary),
        var(--color-primary-light, #ff69b4)
    );
    border-radius: 4px;
    /* UX: 補間された進捗値のための滑らかなトランジション（100ms = 補間更新間隔） */
    /* ease-out で減速を視覚化し、chunk 境界での停止を自然に見せる */
    transition: width 0.1s linear;
    /* 輝きエフェクトで視覚的興味を維持 */
    position: relative;
    overflow: hidden;
}

.upload-progress-bar-fill::after {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 100px;
    background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.2) 50%,
        transparent 100%
    );
    animation: shimmer 2s infinite;
}

@keyframes shimmer {
    0% {
        transform: translateX(-100px);
    }
    100% {
        transform: translateX(calc(100% + 100px));
    }
}

/* 完了時の色変化 - ピーク・エンドの法則 */
.upload-progress-bar-fill--complete {
    background: linear-gradient(90deg, var(--color-success, #22c55e), #4ade80);
    transition:
        background 0.5s ease,
        width 0.3s ease-out;
}

.upload-progress-bar-fill--complete::after {
    animation: none;
}

.upload-progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.5rem;
    padding: 0 0.125rem;
}

.upload-progress-percent {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
    /* 数値の可読性を高める */
    font-variant-numeric: tabular-nums;
}

.upload-progress-bytes {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
}

.upload-phase-text {
    font-size: 0.8125rem;
    color: var(--color-text);
    text-align: center;
    margin-top: 0.75rem;
    font-weight: 500;
}

/* アップロードキュー表示 */
.upload-queue {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
}

.upload-queue-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
}

.upload-queue-title {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.upload-queue-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 150px;
    overflow-y: auto;
}

.upload-queue-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-surface);
    border-radius: 6px;
    transition: background 0.2s ease;
}

.upload-queue-item:hover {
    background: var(--color-border);
}

.upload-queue-filename {
    flex: 1;
    font-size: 0.8125rem;
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.upload-queue-cancel {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.2s ease;
}

.upload-queue-cancel:hover {
    background: var(--color-error, #ef4444);
    color: white;
}

.upload-queue-cancel:active {
    transform: scale(0.95);
}
</style>
