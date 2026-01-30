/**
 * ドラッグアンドドロップ管理
 *
 * ウィンドウ全体でのドラッグアンドドロップを管理するcomposable
 *
 * 設計方針:
 * - グローバルドラッグアンドドロップイベントを登録/削除
 * - 子要素へのドラッグ判定用カウンターで正確な状態管理
 * - ファイル形式チェック（動画ファイルのみ）
 * - 外部コールバックで処理を委譲
 */

import { ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import type { ToastType } from "../types/app";

// 対応する動画ファイル形式
const VIDEO_EXTENSIONS = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/webm",
  "video/ogg",
];

export interface UseDragDrop {
  /** ドラッグ中かどうか */
  isDragging: Ref<boolean>;
  /** グローバルリスナーをセットアップ */
  setupGlobalListeners: () => void;
  /** グローバルリスナーをクリーンアップ */
  cleanupGlobalListeners: () => void;
}

/**
 * ファイルが動画形式かどうかをチェック
 */
function isVideoFile(file: File): boolean {
  return VIDEO_EXTENSIONS.includes(file.type);
}

/**
 * ドラッグアンドドロップ管理のcomposable
 *
 * @param options.onFilesDropped - ファイルがドロップされた時のコールバック
 * @param options.showToast - トースト通知を表示するコールバック
 */
export function useDragDrop(options: {
   onFilesDropped: (files: { filePath: string; fileName: string }[]) => void;
   showToast: (type: ToastType, message: string) => void;
 }): UseDragDrop {
   const isDragging = ref(false);
   const { t } = useI18n();
   let dragCounter = 0; // 子要素へのドラッグ判定用カウンター

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
       options.showToast("error", t("app.upload.error"));
       return;
     }

    // ファイルパスを取得してコールバックに渡す
    const fileItems: { filePath: string; fileName: string }[] = [];
    for (const file of videoFiles) {
      const filePath = (file as any).path || "";
       if (!filePath) {
         options.showToast(
           "error",
           `${file.name}: ${t("uploadErrors.pathError")}`,
         );
         continue;
       }
      fileItems.push({
        filePath,
        fileName: file.name,
      });
    }

    if (fileItems.length > 0) {
      options.onFilesDropped(fileItems);
    }
  }

  /**
   * グローバルドラッグアンドドロップイベントをセットアップ
   * UX原則: ウィンドウ全体でドロップを受け付けることで、ユーザビリティを向上
   */
  function setupGlobalListeners() {
    document.addEventListener("dragenter", handleDragEnter);
    document.addEventListener("dragleave", handleDragLeave);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("drop", handleDrop);
  }

  /**
   * グローバルドラッグアンドドロップイベントをクリーンアップ
   */
  function cleanupGlobalListeners() {
    document.removeEventListener("dragenter", handleDragEnter);
    document.removeEventListener("dragleave", handleDragLeave);
    document.removeEventListener("dragover", handleDragOver);
    document.removeEventListener("drop", handleDrop);
  }

  return {
    isDragging,
    setupGlobalListeners,
    cleanupGlobalListeners,
  };
}
