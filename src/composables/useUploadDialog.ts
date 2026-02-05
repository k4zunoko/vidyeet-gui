/**
 * アップロードダイアログ管理
 *
 * アップロードダイアログの状態、キュー処理、進捗補間を統合管理するcomposable
 *
 * 設計方針:
 * - 状態管理: アップロードダイアログの表示状態と進捗を管理
 * - キュー統合: useUploadQueue を内部で使用し、逐次処理を実装
 * - 進捗補間: useProgressInterpolation で滑らかな進捗表示を実現
 * - コールバック駆動: showToast, onUploadComplete で外部連携
 *
 * UX原則:
 * - ノンモーダル設計: ユーザーに制御を与える (NN/g)
 * - 認知負荷軽減: 短く明確なテキスト
 * - フレーミング効果: ポジティブな表現を使用
 * - 10秒以上の処理には percent-done indicator を使用
 *
 * @see docs/UX_PSYCHOLOGY.md
 */

import { ref } from "vue";
import type { Ref } from "vue";
import { useI18n } from "vue-i18n";
import type { UploadProgress } from "../../electron/types/ipc";
import { isIpcError } from "../../electron/types/ipc";
import type { ToastType } from "../types/app";
import { useUploadQueue } from "./useUploadQueue";
import { useProgressInterpolation } from "./useProgressInterpolation";
import type { UseUploadQueue } from "./useUploadQueue";

// =============================================================================
// Types
// =============================================================================

/** アップロードダイアログの状態 */
export interface UploadDialogState {
  /** ダイアログが開いているか */
  isOpen: boolean;
  /** 最小化されているか（ノンモーダル状態） */
  isMinimized: boolean;
  /** 現在のファイル名 */
  fileName: string;
  /** 現在のフェーズ */
  phase: string;
  /** フェーズの日本語テキスト */
  phaseText: string;
  /** アップロード中かどうか */
  isUploading: boolean;
  /** エラーメッセージ */
  errorMessage: string | null;
  /** 進捗率（0-100） */
  progressPercent: number;
  /** 現在のチャンク番号 */
  currentChunk: number;
  /** 総チャンク数 */
  totalChunks: number;
  /** 送信済みバイト数 */
  bytesSent: number;
  /** 総バイト数 */
  totalBytes: number;
  /** プログレスバーを表示するか */
  showProgressBar: boolean;
  /** キャンセル処理中かどうか */
  isCancelling: boolean;
}

/** useUploadDialog のオプション */
export interface UseUploadDialogOptions {
  /** トースト通知を表示するコールバック */
  showToast: (type: ToastType, message: string) => void;
  /** アップロード完了時のコールバック（ライブラリ再読み込み用） */
  onUploadComplete: () => void;
}

/** useUploadDialog の戻り値 */
export interface UseUploadDialog {
  /** アップロードダイアログの状態 */
  uploadDialogState: Ref<UploadDialogState>;
  /** アップロードキュー */
  uploadQueue: UseUploadQueue;
  /** 複数ファイルをキューに追加して処理開始 */
  handleMultipleFiles: (files: File[]) => Promise<void>;
  /** アップロードダイアログを閉じる */
  closeUploadDialog: () => void;
  /** 現在アップロード中のファイルをキャンセル */
  cancelCurrentUpload: () => Promise<void>;
  /** アップロードダイアログを最小化 */
  minimizeUploadDialog: () => void;
  /** アップロードダイアログを復元 */
  restoreUploadDialog: () => void;
  /** キュー内のアイテムをキャンセル */
  cancelQueueItem: (id: number) => void;
  /** バイト数を人間が読みやすい形式に変換 */
  formatBytes: (bytes: number) => string;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * アップロードダイアログ管理のcomposable
 *
 * @param options - コールバックオプション
 * @returns アップロードダイアログの状態と操作関数
 */
export function useUploadDialog(
   options: UseUploadDialogOptions,
): UseUploadDialog {
   const { showToast, onUploadComplete } = options;
   const { t } = useI18n();

  // ===========================================================================
  // State
  // ===========================================================================

  /** アップロードダイアログの状態 */
  const uploadDialogState = ref<UploadDialogState>({
    isOpen: false,
    isMinimized: false,
    fileName: "",
    phase: "",
    phaseText: "",
    isUploading: false,
    errorMessage: null,
    progressPercent: 0,
    currentChunk: 0,
    totalChunks: 0,
    bytesSent: 0,
    totalBytes: 0,
    showProgressBar: false,
    isCancelling: false,
  });

  /** アップロードキュー */
  const uploadQueue = useUploadQueue();

  /** 現在アップロード中のuploadId */
  const currentUploadId = ref<string | null>(null);

   /** 現在の進捗補間ハンドラ（キャンセル時のクリーンアップ用） */
   let currentProgressCleanup: (() => void) | null = null;

   /** 保留中のキュー処理タイマーID（二重実行防止用） */
   let pendingQueueTimer: ReturnType<typeof setTimeout> | null = null;

  // ===========================================================================
  // Helper Functions
  // ===========================================================================

   /**
    * アップロードフェーズを日本語に変換
    *
    * UX原則:
    * - 認知負荷軽減: 短く明確なテキスト
    * - フレーミング効果: ポジティブな表現を使用
    */
   function getPhaseText(phase: string): string {
     const phaseKeys: Record<string, string> = {
       validating_file: "uploadPhase.validating",
       file_validated: "uploadPhase.validationComplete",
       creating_direct_upload: "uploadPhase.preparing",
       direct_upload_created: "uploadPhase.prepareComplete",
       uploading_file: "uploadPhase.uploading",
       uploading_chunk: "uploadPhase.uploading",
       file_uploaded: "uploadPhase.completed",
       waiting_for_asset: "uploadPhase.processing",
       completed: "uploadPhase.done",
     };
     const key = phaseKeys[phase];
     return key ? t(key) : phase;
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

  // ===========================================================================
  // Progress Handler
  // ===========================================================================

  /**
   * 進捗補間ハンドラを生成（アップロードごとに独立）
   */
  function createUploadProgressHandler() {
    let progressInterpolation: ReturnType<
      typeof useProgressInterpolation
    > | null = null;

    const onProgress = (progress: UploadProgress) => {
      // Capture uploadId when first available
      if (progress.uploadId && !currentUploadId.value) {
        currentUploadId.value = progress.uploadId;
      }

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
                uploadDialogState.value.bytesSent = Math.round(displayBytes);
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
          uploadDialogState.value.bytesSent = uploadDialogState.value.totalBytes;
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

  // ===========================================================================
  // Queue Processing
  // ===========================================================================

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
     currentUploadId.value = null; // Reset before new upload
     uploadDialogState.value.fileName = item.fileName;
     uploadDialogState.value.phase = "starting";
     uploadDialogState.value.phaseText = t("uploadPhase.starting");
     uploadDialogState.value.isUploading = true;
     uploadDialogState.value.errorMessage = null;
    uploadDialogState.value.progressPercent = 0;
    uploadDialogState.value.currentChunk = 0;
    uploadDialogState.value.totalChunks = 0;
    uploadDialogState.value.bytesSent = 0;
    uploadDialogState.value.totalBytes = 0;
    uploadDialogState.value.showProgressBar = false;

    const { onProgress, cleanup } = createUploadProgressHandler();
    currentProgressCleanup = cleanup; // Store for potential cancellation

    // アップロード実行
    const uploadResult = await window.vidyeet.upload(
      { filePath: item.filePath },
      onProgress,
    );

     if (isIpcError(uploadResult)) {
       // エラー: キューに記録
       uploadQueue.markCurrentError(uploadResult.message);
       currentUploadId.value = null;
       currentProgressCleanup = null;
       uploadDialogState.value.isUploading = false;
       uploadDialogState.value.errorMessage = uploadResult.message;
       cleanup();

        // エラートースト表示
        showToast("error", `${item.fileName}: ${t("uploadErrors.uploadFailed")}`);

       // 次のファイルを処理（少し待ってから）
       pendingQueueTimer = setTimeout(() => {
         pendingQueueTimer = null;
         processUploadQueue();
       }, 1000);
       return;
     }

      // 成功: キューに記録
      uploadQueue.markCurrentCompleted(uploadResult.assetId);
      currentUploadId.value = null;
      currentProgressCleanup = null;
      uploadDialogState.value.phase = "completed";
      uploadDialogState.value.phaseText = `${t("uploadPhase.completed")}！`;
      uploadDialogState.value.isUploading = false;

     // 個別リロード: 成功したファイルをすぐに一覧に追加
     onUploadComplete();

     cleanup();

     // 次のファイルを処理（少し待ってから）
     pendingQueueTimer = setTimeout(() => {
       pendingQueueTimer = null;
       processUploadQueue();
     }, 800);
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * 複数ファイルをキューに追加して処理開始
   */
  async function handleMultipleFiles(files: File[]) {
    // ファイルパスを取得
    const fileItems: { filePath: string; fileName: string }[] = [];
     for (const file of files) {
       const filePath = (file as any).path || "";
       if (!filePath) {
         showToast("error", `${file.name}: ${t("uploadErrors.pathError")}`);
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
    * Cancel the currently uploading file
    */
   async function cancelCurrentUpload(): Promise<void> {
     if (!currentUploadId.value) {
       console.warn("No active upload to cancel");
       return;
     }

     const uploadIdToCancel = currentUploadId.value;
     
     // Set cancelling state immediately (Doherty Threshold: <100ms feedback)
     uploadDialogState.value.isCancelling = true;
     uploadQueue.updateCurrentStatus("cancelling");

     try {
       // Call IPC to kill CLI process
       const result = await window.vidyeet.cancelUpload(uploadIdToCancel);
       
       if (result.success) {
         // Clear any pending error handler timer to prevent double queue processing
         if (pendingQueueTimer) {
           clearTimeout(pendingQueueTimer);
           pendingQueueTimer = null;
         }
         
         // Mark as error with neutral message
         uploadQueue.markCurrentError("キャンセルされました");
         
         // Show toast notification
         showToast("info", "アップロードをキャンセルしました");
         
         // Clean up state
         currentUploadId.value = null;
         uploadDialogState.value.isCancelling = false;
         uploadDialogState.value.isUploading = false;
         
         // Clean up progress interpolation if exists
         if (currentProgressCleanup) {
           currentProgressCleanup();
           currentProgressCleanup = null;
         }
         
         // Continue to next item in queue
         pendingQueueTimer = setTimeout(() => {
           pendingQueueTimer = null;
           processUploadQueue();
         }, 500);
       } else {
         // Upload already completed/not found
         console.warn("Upload not found or already completed");
         uploadDialogState.value.isCancelling = false;
       }
     } catch (error) {
       console.error("Failed to cancel upload:", error);
       showToast("error", "キャンセルに失敗しました");
       uploadDialogState.value.isCancelling = false;
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

  // ===========================================================================
  // Return
  // ===========================================================================

  return {
    uploadDialogState,
    uploadQueue,
    handleMultipleFiles,
    closeUploadDialog,
    cancelCurrentUpload,
    minimizeUploadDialog,
    restoreUploadDialog,
    cancelQueueItem,
    formatBytes,
  };
}
