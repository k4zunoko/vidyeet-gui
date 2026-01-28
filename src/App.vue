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
import type { AppScreen, VideoItem, ToastItem, ToastType } from "./types/app";
import type { UploadProgress } from "../electron/types/ipc";
import { isIpcError } from "../electron/types/ipc";
import { useProgressInterpolation } from "./composables/useProgressInterpolation";
import { useUploadQueue } from "./composables/useUploadQueue";
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
// ドラッグアンドドロップ状態
// =============================================================================
const isDragging = ref(false);
let dragCounter = 0; // 子要素へのドラッグ判定用カウンター

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
// トースト通知状態
// =============================================================================
const toasts = ref<ToastItem[]>([]);
let toastIdCounter = 0;

/**
 * トースト通知を表示
 * @param type - 通知タイプ
 * @param message - 表示メッセージ
 * @param duration - 自動消去までの時間（ミリ秒）。デフォルトは成功3秒、エラー5秒
 */
function showToast(type: ToastType, message: string, duration?: number) {
    const defaultDuration = type === "error" ? 5000 : 3000;
    const id = ++toastIdCounter;
    const toast: ToastItem = {
        id,
        type,
        message,
        duration: duration ?? defaultDuration,
    };

    // 最大3件まで保持（古いものを削除）
    if (toasts.value.length >= 3) {
        toasts.value.shift();
    }
    toasts.value.push(toast);

    // 自動消去タイマー
    setTimeout(() => {
        removeToast(id);
    }, toast.duration);
}

/**
 * トーストを削除
 */
function removeToast(id: number) {
    const index = toasts.value.findIndex((t) => t.id === id);
    if (index !== -1) {
        toasts.value.splice(index, 1);
    }
}

// =============================================================================
// アップロードダイアログ状態
// =============================================================================
const uploadDialogState = ref({
    isOpen: false,
    isMinimized: false, // ノンモーダル最小化状態
    fileName: "",
    phase: "" as string,
    phaseText: "",
    isUploading: false,
    errorMessage: null as string | null,
    // プログレスバー用のフィールド
    progressPercent: 0,
    currentChunk: 0,
    totalChunks: 0,
    bytesSent: 0,
    totalBytes: 0,
    showProgressBar: false,
});

// =============================================================================
// アップロードキュー
// =============================================================================
const uploadQueue = useUploadQueue();

// 進捗補間ハンドラを生成（アップロードごとに独立）
function createUploadProgressHandler() {
    let progressInterpolation: ReturnType<
        typeof useProgressInterpolation
    > | null = null;

    const onProgress = (progress: UploadProgress) => {
        // 進捗更新
        uploadDialogState.value.phase = progress.phase;
        uploadDialogState.value.phaseText = getPhaseText(progress.phase);

        // uploading_file フェーズでプログレスバーを0%表示と補間初期化
        // CLI仕様 v1.1: uploading_file に total_chunks が含まれるようになった
        // Warmup モード: 第1chunk完了までの間だけ time-based で進捗を滑らかに表示
        // UX原則: 10秒以上の処理には percent-done indicator を使用 (NN/g)
        if (progress.phase === "uploading_file") {
            uploadDialogState.value.showProgressBar = true;
            uploadDialogState.value.progressPercent = 0;
            uploadDialogState.value.totalBytes = progress.sizeBytes ?? 0;
            uploadDialogState.value.totalChunks = progress.totalChunks ?? 0;

            // 進捗補間を初期化（コールバックで UI を更新）
            const totalBytes = progress.sizeBytes ?? 0;
            const totalChunks = progress.totalChunks ?? 0;
            if (totalBytes > 0) {
                progressInterpolation = useProgressInterpolation(
                    totalBytes,
                    (displayBytes, displayPercent) => {
                        // 補間された値で UI を更新
                        if (uploadDialogState.value.showProgressBar) {
                            uploadDialogState.value.bytesSent =
                                Math.round(displayBytes);
                            uploadDialogState.value.progressPercent =
                                Math.round(displayPercent);
                        }
                    },
                );

                // アップロード開始時刻を記録
                progressInterpolation.startUpload();

                // Warmup モードを初期化（total_chunks 確定時）
                if (totalChunks > 0) {
                    progressInterpolation.initializeWarmup(totalChunks);
                }
            }
        }

        // uploading_chunk フェーズでプログレスバーを更新（補間適用）
        if (
            progress.phase === "uploading_chunk" &&
            progress.totalBytes &&
            progress.bytesSent !== undefined
        ) {
            uploadDialogState.value.showProgressBar = true;
            uploadDialogState.value.currentChunk = progress.currentChunk ?? 0;
            uploadDialogState.value.totalChunks = progress.totalChunks ?? 0;
            uploadDialogState.value.totalBytes = progress.totalBytes;

            // Truth（確定値）を更新（コールバックで UI が自動更新される）
            if (progressInterpolation) {
                progressInterpolation.updateTruth(progress.bytesSent);
            } else {
                // フォールバック: 補間が初期化されていない場合は直接設定
                uploadDialogState.value.bytesSent = progress.bytesSent;
                uploadDialogState.value.progressPercent = Math.round(
                    (progress.bytesSent / progress.totalBytes) * 100,
                );
            }
        }

        // file_uploaded, waiting_for_asset, completed ではプログレスバーを100%に
        if (
            ["file_uploaded", "waiting_for_asset", "completed"].includes(
                progress.phase,
            )
        ) {
            if (uploadDialogState.value.showProgressBar) {
                // 補間を停止し、100% に設定
                if (progressInterpolation) {
                    progressInterpolation.updateTruth(
                        uploadDialogState.value.totalBytes,
                    );
                }
                uploadDialogState.value.progressPercent = 100;
                uploadDialogState.value.bytesSent =
                    uploadDialogState.value.totalBytes;
            }
        }
    };

    const cleanup = () => {
        // 進捗補間を停止してリセット
        if (progressInterpolation) {
            progressInterpolation.reset();
            progressInterpolation = null;
        }

        // uploadDialogState の進捗フィールドをリセット
        uploadDialogState.value.progressPercent = 0;
        uploadDialogState.value.currentChunk = 0;
        uploadDialogState.value.totalChunks = 0;
        uploadDialogState.value.bytesSent = 0;
        uploadDialogState.value.totalBytes = 0;
        uploadDialogState.value.showProgressBar = false;
    };

    return { onProgress, cleanup };
}

/**
 * アップロードフェーズを日本語に変換
 *
 * UX原則:
 * - 認知負荷軽減: 短く明確なテキスト
 * - フレーミング効果: ポジティブな表現を使用
 */
function getPhaseText(phase: string): string {
    const phaseMap: Record<string, string> = {
        validating_file: "ファイルを検証中...",
        file_validated: "ファイル検証完了",
        creating_direct_upload: "アップロード準備中...",
        direct_upload_created: "アップロード準備完了",
        uploading_file: "アップロード中...",
        uploading_chunk: "アップロード中...",
        file_uploaded: "アップロード完了",
        waiting_for_asset: "処理中...",
        completed: "完了",
    };
    return phaseMap[phase] || phase;
}

/**
 * バイト数を人間が読みやすい形式に変換
 */
function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
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
// ドラッグアンドドロップ操作
// =============================================================================

/**
 * ファイルが動画形式かどうかをチェック
 */
function isVideoFile(file: File): boolean {
    const videoTypes = [
        "video/mp4",
        "video/quicktime",
        "video/x-msvideo",
        "video/x-matroska",
        "video/webm",
        "video/ogg",
    ];
    return videoTypes.includes(file.type);
}

/**
 * dragenter イベントハンドラ
 * UX原則: ドハティの閾値 - 即座に視覚的フィードバックを提供
 */
function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    dragCounter++;
    if (dragCounter === 1) {
        isDragging.value = true;
    }
}

/**
 * dragleave イベントハンドラ
 */
function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    dragCounter--;
    if (dragCounter === 0) {
        isDragging.value = false;
    }
}

/**
 * dragover イベントハンドラ
 */
function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
}

/**
 * drop イベントハンドラ
 * UX原則:
 * - ドハティの閾値: ドロップ後即座にアップロード進捗ダイアログを表示
 * - フレーミング効果: エラーは次の行動を示唆
 */
async function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    // ドラッグ状態をリセット
    isDragging.value = false;
    dragCounter = 0;

    // ファイルを取得
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) {
        return;
    }

    // 動画形式チェック（複数ファイル対応）
    const videoFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (isVideoFile(file)) {
            videoFiles.push(file);
        }
    }

    if (videoFiles.length === 0) {
        showToast("error", "動画ファイルのみアップロードできます");
        return;
    }

    // ファイルパスを取得してキューに追加
    await handleMultipleFiles(videoFiles);
}

/**
 * 複数ファイルをキューに追加して処理開始
 */
async function handleMultipleFiles(files: File[]) {
    // ファイルパスを取得
    const fileItems: { filePath: string; fileName: string }[] = [];
    for (const file of files) {
        const filePath = (file as any).path || "";
        if (!filePath) {
            showToast(
                "error",
                `${file.name}: ファイルパスの取得に失敗しました`,
            );
            continue;
        }
        fileItems.push({
            filePath,
            fileName: file.name,
        });
    }

    if (fileItems.length === 0) {
        return;
    }

    // キューに追加
    uploadQueue.enqueue(fileItems);

    // ダイアログを開く
    uploadDialogState.value.isOpen = true;
    uploadDialogState.value.isMinimized = false;

    // キューが処理中でなければ開始
    if (!uploadQueue.isProcessing.value) {
        await processUploadQueue();
    }
}

/**
 * アップロードキューを処理
 */
async function processUploadQueue() {
    // 次のアイテムを取得
    const item = uploadQueue.startNext();
    if (!item) {
        // キュー完了
        uploadDialogState.value.isOpen = false;

        const stats = uploadQueue.stats.value;
        if (stats.completed > 0) {
            if (stats.error > 0) {
                showToast(
                    "info",
                    `${stats.completed}件完了、${stats.error}件失敗しました`,
                );
            } else {
                showToast(
                    "success",
                    `${stats.completed}件のアップロードが完了しました`,
                );
            }
        }

        // キューをクリア
        uploadQueue.clear();
        return;
    }

    // アップロード状態を初期化
    uploadDialogState.value.fileName = item.fileName;
    uploadDialogState.value.phase = "starting";
    uploadDialogState.value.phaseText = "開始中...";
    uploadDialogState.value.isUploading = true;
    uploadDialogState.value.errorMessage = null;
    uploadDialogState.value.progressPercent = 0;
    uploadDialogState.value.currentChunk = 0;
    uploadDialogState.value.totalChunks = 0;
    uploadDialogState.value.bytesSent = 0;
    uploadDialogState.value.totalBytes = 0;
    uploadDialogState.value.showProgressBar = false;

    const { onProgress, cleanup } = createUploadProgressHandler();

    // アップロード実行
    const uploadResult = await window.vidyeet.upload(
        { filePath: item.filePath },
        onProgress,
    );

    if (isIpcError(uploadResult)) {
        // エラー: キューに記録
        uploadQueue.markCurrentError(uploadResult.message);
        uploadDialogState.value.isUploading = false;
        uploadDialogState.value.errorMessage = uploadResult.message;
        cleanup();

        // エラートースト表示
        showToast("error", `${item.fileName}: アップロード失敗`);

        // 次のファイルを処理（少し待ってから）
        setTimeout(() => {
            processUploadQueue();
        }, 1000);
        return;
    }

    // 成功: キューに記録
    uploadQueue.markCurrentCompleted(uploadResult.assetId);
    uploadDialogState.value.phase = "completed";
    uploadDialogState.value.phaseText = "アップロード完了！";
    uploadDialogState.value.isUploading = false;

    // 個別リロード: 成功したファイルをすぐに一覧に追加
    libraryRef.value?.reload();

    cleanup();

    // 次のファイルを処理（少し待ってから）
    setTimeout(() => {
        processUploadQueue();
    }, 800);
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

    // キューに追加
    uploadQueue.enqueue([
        {
            filePath: selectResult.filePath,
            fileName,
        },
    ]);

    // ダイアログを開く
    uploadDialogState.value.isOpen = true;
    uploadDialogState.value.isMinimized = false;

    // キューが処理中でなければ開始
    if (!uploadQueue.isProcessing.value) {
        await processUploadQueue();
    }
}

/**
 * アップロードダイアログを閉じる
 *
 * エラー後にダイアログを閉じる際、進捗データをリセットして
 * 次回アップロード時に前回の進捗が残らないようにする
 */
function closeUploadDialog() {
    if (!uploadDialogState.value.isUploading) {
        uploadDialogState.value.isOpen = false;
        uploadDialogState.value.isMinimized = false;

        // 進捗データをリセット（防御的プログラミング）
        uploadDialogState.value.progressPercent = 0;
        uploadDialogState.value.currentChunk = 0;
        uploadDialogState.value.totalChunks = 0;
        uploadDialogState.value.bytesSent = 0;
        uploadDialogState.value.totalBytes = 0;
        uploadDialogState.value.showProgressBar = false;
        uploadDialogState.value.errorMessage = null;
        uploadDialogState.value.phase = "";
        uploadDialogState.value.phaseText = "";

        // キューもクリア
        uploadQueue.clear();
    }
}

/**
 * キュー内のアイテムをキャンセル
 */
function cancelQueueItem(id: number) {
    uploadQueue.cancel(id);
}

/**
 * アップロードダイアログを最小化
 * UX原則: ユーザーに制御を与える (NN/g)
 */
function minimizeUploadDialog() {
    uploadDialogState.value.isMinimized = true;
}

/**
 * アップロードダイアログを復元（最小化解除）
 */
function restoreUploadDialog() {
    uploadDialogState.value.isMinimized = false;
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
            deleteDialogState.value.errorMessage = "動画の削除に失敗しました。";
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

        // トースト通知を表示
        showToast("success", "動画を削除しました");
    } catch (err) {
        deleteDialogState.value.errorMessage = "削除中にエラーが発生しました。";
    } finally {
        deleteDialogState.value.isDeleting = false;
    }
}

/**
 * マウント時の初期化
 * - 認証チェック
 * - グローバルドラッグアンドドロップイベントの登録
 */
onMounted(() => {
    checkAuth();

    // グローバルドラッグアンドドロップイベントを登録
    // UX原則: ウィンドウ全体でドロップを受け付けることで、ユーザビリティを向上
    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);
});

/**
 * アンマウント時のクリーンアップ
 */
onBeforeUnmount(() => {
    // イベントリスナーを削除
    document.removeEventListener("dragenter", handleDragEnter);
    document.removeEventListener("dragleave", handleDragLeave);
    document.removeEventListener("dragover", handleDragOver);
    document.removeEventListener("drop", handleDrop);

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
                        @contextmenu="showContextMenu"
                        @upload="handleUpload"
                    />
                </aside>

                <!-- メインエリア: プレイヤー + 情報パネル -->
                <div class="main-area">
                    <main class="main-content">
                        <VideoPlayer
                            :video="selectedVideo"
                            @contextmenu="showContextMenu"
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
                :is-open="contextMenuState.isOpen"
                :video="contextMenuState.video"
                :x="contextMenuState.x"
                :y="contextMenuState.y"
                @close="closeContextMenu"
                @delete="handleDeleteRequest"
                @copy-success="
                    () => showToast('success', 'リンクをコピーしました')
                "
            />

            <!-- 削除確認ダイアログ -->
            <Teleport to="body">
                <Transition name="dialog">
                    <div
                        v-if="deleteDialogState.isOpen"
                        class="dialog-overlay"
                        @click.self="cancelDelete"
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
                                v-if="deleteDialogState.errorMessage"
                                class="dialog-error"
                            >
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
                                    {{
                                        deleteDialogState.isDeleting
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
                        v-if="uploadDialogState.isOpen"
                        class="upload-dialog-nonmodal"
                        :class="{
                            'upload-dialog-nonmodal--minimized':
                                uploadDialogState.isMinimized,
                        }"
                        role="dialog"
                        aria-labelledby="upload-dialog-title"
                    >
                        <!-- 最小化状態: コンパクトバー -->
                        <!-- UX原則: エラーは目立つ視覚的指標で表示（NN/g）、視覚的階層でエラーアイコンを最も目立たせる -->
                        <div
                            v-if="uploadDialogState.isMinimized"
                            class="upload-minimized-bar"
                            :class="{
                                'upload-minimized-bar--error':
                                    uploadDialogState.errorMessage,
                            }"
                            @click="restoreUploadDialog"
                            :title="
                                uploadDialogState.errorMessage
                                    ? 'クリックして詳細を確認'
                                    : 'クリックして展開'
                            "
                        >
                            <!-- エラー時: エラーアイコン -->
                            <svg
                                v-if="uploadDialogState.errorMessage"
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
                                v-else-if="uploadDialogState.isUploading"
                                class="upload-minimized-spinner"
                            ></div>

                            <!-- 成功時: チェックマーク（短時間表示） -->
                            <svg
                                v-else-if="
                                    uploadDialogState.phase === 'completed'
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
                                    uploadDialogState.errorMessage
                                        ? "アップロード失敗"
                                        : uploadDialogState.fileName
                                }}
                            </span>

                            <!-- 進捗率: エラー時は非表示（認知負荷を減らす） -->
                            <!-- 進捗率または件数: エラー時は非表示 -->
                            <span
                                v-if="!uploadDialogState.errorMessage"
                                class="upload-minimized-percent"
                            >
                                <template
                                    v-if="uploadQueue.stats.value.total > 1"
                                >
                                    {{
                                        uploadQueue.stats.value.completed +
                                        uploadQueue.stats.value.uploading
                                    }}/{{ uploadQueue.stats.value.total }}
                                </template>
                                <template
                                    v-else-if="uploadDialogState.isUploading"
                                >
                                    {{ uploadDialogState.progressPercent }}%
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
                                        uploadDialogState.errorMessage
                                            ? "アップロードエラー"
                                            : uploadQueue.stats.value.total > 1
                                              ? `アップロード中 (${uploadQueue.stats.value.completed + uploadQueue.stats.value.uploading}/${uploadQueue.stats.value.total})`
                                              : "アップロード中"
                                    }}
                                </h2>
                                <div class="upload-dialog-controls">
                                    <button
                                        v-if="!uploadDialogState.errorMessage"
                                        class="upload-control-button"
                                        @click="minimizeUploadDialog"
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
                                        v-if="uploadDialogState.errorMessage"
                                        class="upload-control-button"
                                        @click="closeUploadDialog"
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
                            <template v-if="uploadDialogState.errorMessage">
                                <p class="upload-error-message">
                                    {{ uploadDialogState.errorMessage }}
                                </p>
                            </template>

                            <!-- 現在のファイル: 進捗表示 -->
                            <template v-else>
                                <p class="upload-filename">
                                    {{ uploadDialogState.fileName }}
                                </p>

                                <!-- プログレスバー表示 (uploading_chunk フェーズ時) -->
                                <!-- UX原則: percent-done indicator は10秒以上の処理に効果的 (NN/g) -->
                                <div
                                    v-if="uploadDialogState.showProgressBar"
                                    class="upload-progress-bar-container"
                                >
                                    <div class="upload-progress-bar-track">
                                        <div
                                            class="upload-progress-bar-fill"
                                            :class="{
                                                'upload-progress-bar-fill--complete':
                                                    uploadDialogState.progressPercent >=
                                                    100,
                                            }"
                                            :style="{
                                                width: `${uploadDialogState.progressPercent}%`,
                                            }"
                                        ></div>
                                    </div>
                                    <div class="upload-progress-info">
                                        <span class="upload-progress-percent"
                                            >{{
                                                uploadDialogState.progressPercent
                                            }}%</span
                                        >
                                        <span class="upload-progress-bytes">
                                            {{
                                                formatBytes(
                                                    uploadDialogState.bytesSent,
                                                )
                                            }}
                                            /
                                            {{
                                                formatBytes(
                                                    uploadDialogState.totalBytes,
                                                )
                                            }}
                                        </span>
                                    </div>
                                </div>

                                <!-- スピナー表示 (プログレスバーが無い時) -->
                                <div v-else class="upload-progress">
                                    <div
                                        class="upload-spinner"
                                        v-if="uploadDialogState.isUploading"
                                    ></div>
                                    <span
                                        class="upload-phase"
                                        :class="{
                                            'upload-phase--complete':
                                                uploadDialogState.phase ===
                                                'completed',
                                        }"
                                    >
                                        {{ uploadDialogState.phaseText }}
                                    </span>
                                </div>

                                <!-- フェーズテキスト (プログレスバー表示時も表示) -->
                                <p
                                    v-if="uploadDialogState.showProgressBar"
                                    class="upload-phase-text"
                                >
                                    {{ uploadDialogState.phaseText }}
                                </p>
                            </template>

                            <!-- キュー表示 -->
                            <div
                                v-if="uploadQueue.items.value.length > 1"
                                class="upload-queue"
                            >
                                <div class="upload-queue-header">
                                    <span class="upload-queue-title"
                                        >待機中 ({{
                                            uploadQueue.stats.value.waiting
                                        }}件)</span
                                    >
                                </div>
                                <div class="upload-queue-list">
                                    <div
                                        v-for="item in uploadQueue.items.value.filter(
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
                                            @click="cancelQueueItem(item.id)"
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
            <DragDropOverlay :is-dragging="isDragging" />
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
