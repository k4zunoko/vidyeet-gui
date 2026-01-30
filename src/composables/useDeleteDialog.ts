/**
 * 削除確認ダイアログ管理
 *
 * 動画削除の確認ダイアログの状態と操作を管理するcomposable
 *
 * 設計方針:
 * - ダイアログの表示/非表示状態を管理
 * - 削除処理中のローディング状態を管理
 * - エラーメッセージを表示
 * - 外部依存（IPC呼び出し、コールバック）は注入可能に設計
 */

import { ref, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import type { VideoItem, ToastType } from "../types/app";

/**
 * 削除ダイアログの状態
 */
export interface DeleteDialogState {
  /** ダイアログが開いているかどうか */
  isOpen: boolean;
  /** 削除対象の動画（nullの場合はダイアログが閉じている） */
  video: VideoItem | null;
  /** 削除処理中かどうか */
  isDeleting: boolean;
  /** エラーメッセージ（nullの場合はエラーなし） */
  errorMessage: string | null;
}

/**
 * useDeleteDialog の戻り値型
 */
export interface UseDeleteDialog {
  /** 削除ダイアログの状態 */
  state: Ref<DeleteDialogState>;
  /** 削除ダイアログを開く */
  openDeleteDialog: (video: VideoItem) => void;
  /** 削除をキャンセル */
  cancelDelete: () => void;
  /** 削除を実行 */
  confirmDelete: () => Promise<void>;
}

/**
 * useDeleteDialog のオプション
 */
export interface UseDeleteDialogOptions {
  /** 削除を実行するコールバック（IPC呼び出しなど） */
  onDelete: (assetId: string) => Promise<void>;
  /** 削除成功時のコールバック */
  onDeleted: (assetId: string) => void;
  /** トースト通知を表示するコールバック */
  showToast: (type: ToastType, message: string) => void;
}

/**
 * 削除確認ダイアログ管理のcomposable
 *
 * @param options - 外部依存のコールバック
 * @returns 削除ダイアログの状態と操作メソッド
 */
export function useDeleteDialog(options: UseDeleteDialogOptions): UseDeleteDialog {
   // 削除ダイアログの状態
   const state = ref<DeleteDialogState>({
     isOpen: false,
     video: null,
     isDeleting: false,
     errorMessage: null,
   });
   const { t } = useI18n();

  /**
   * 削除ダイアログを開く
   *
   * @param video - 削除対象の動画
   */
  function openDeleteDialog(video: VideoItem): void {
    state.value = {
      isOpen: true,
      video,
      isDeleting: false,
      errorMessage: null,
    };
  }

  /**
   * 削除をキャンセル
   */
  function cancelDelete(): void {
    state.value.isOpen = false;
    state.value.video = null;
  }

  /**
   * 削除を実行
   *
   * IPC呼び出しで削除を実行し、成功時にコールバックを呼び出す
   */
  async function confirmDelete(): Promise<void> {
    const video = state.value.video;
    if (!video) return;

    state.value.isDeleting = true;
    state.value.errorMessage = null;

    try {
      // 削除を実行（IPC呼び出し）
      await options.onDelete(video.assetId);

      // 削除成功: コールバックを呼び出す
      options.onDeleted(video.assetId);

       // ダイアログを閉じる
       state.value.isOpen = false;
       state.value.video = null;

       // トースト通知を表示
       options.showToast("success", t("app.deleteDialog.success"));
     } catch (err) {
       // エラーメッセージを設定
       state.value.errorMessage = t("app.deleteDialog.error");
    } finally {
      state.value.isDeleting = false;
    }
  }

  return {
    state,
    openDeleteDialog,
    cancelDelete,
    confirmDelete,
  };
}
