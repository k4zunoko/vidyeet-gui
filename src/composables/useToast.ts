/**
 * トースト通知管理
 *
 * 複数のトースト通知を管理するcomposable
 *
 * 設計方針:
 * - 最大3件まで保持（古いものを削除）
 * - 自動消去タイマー（成功3秒、エラー5秒）
 * - 手動削除も可能
 */

import { ref, type Ref } from "vue";
import type { ToastItem, ToastType } from "../types/app";

let toastIdCounter = 0;

export interface UseToast {
  /** トースト通知のリスト */
  toasts: Ref<ToastItem[]>;
  /** トースト通知を表示 */
  showToast: (type: ToastType, message: string, duration?: number) => void;
  /** トースト通知を削除 */
  removeToast: (id: number) => void;
}

/**
 * トースト通知管理のcomposable
 */
export function useToast(): UseToast {
  // トースト通知のリスト
  const toasts = ref<ToastItem[]>([]);

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

  return {
    toasts,
    showToast,
    removeToast,
  };
}
