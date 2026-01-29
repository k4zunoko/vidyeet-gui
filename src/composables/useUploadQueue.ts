/**
 * アップロードキュー管理
 *
 * 複数ファイルの逐次アップロードを管理するcomposable
 *
 * 設計方針:
 * - 逐次実行: 1つずつアップロードを処理（並列実行なし）
 * - エラー継続: 1ファイル失敗しても次のファイルを処理
 * - 個別リロード: 各ファイル成功時に一覧を更新
 * - 状態管理: Reactiveな状態でUIと連携
 *
 * CLI と GUI の責務分離は docs/README.md、CLI_CONTRACT.md 参照
 */

import { ref, computed, type Ref, type ComputedRef } from "vue";
import type { QueueItem, QueueStats, QueueItemStatus } from "../types/app";

let queueItemIdCounter = 0;

export interface UseUploadQueue {
  /** キューアイテムのリスト */
  items: Ref<QueueItem[]>;
  /** 現在アップロード中のアイテム */
  currentItem: Ref<QueueItem | null>;
  /** キューの統計情報 */
  stats: ComputedRef<QueueStats>;
  /** キューが空かどうか */
  isEmpty: ComputedRef<boolean>;
  /** キューが実行中かどうか */
  isProcessing: Ref<boolean>;

  /** ファイルをキューに追加 */
  enqueue(files: { filePath: string; fileName: string }[]): void;
  /** 現在のアイテムのステータスを更新 */
  updateCurrentStatus(status: QueueItemStatus): void;
  /** 現在のアイテムをエラー状態にする */
  markCurrentError(error: string): void;
  /** 現在のアイテムを完了状態にする */
  markCurrentCompleted(assetId: string): void;
  /** 次のアイテムを取得して処理開始 */
  startNext(): QueueItem | null;
  /** 特定のアイテムをキャンセル（待機中のみ） */
  cancel(id: number): void;
  /** キューをクリア */
  clear(): void;
}

/**
 * アップロードキュー管理のcomposable
 */
export function useUploadQueue(): UseUploadQueue {
  // キューアイテムのリスト
  const items = ref<QueueItem[]>([]);

  // 現在アップロード中のアイテム
  const currentItem = ref<QueueItem | null>(null);

  // キューが実行中かどうか
  const isProcessing = ref(false);

  // キューの統計情報
  const stats = computed<QueueStats>(() => {
    const total = items.value.length;
    const waiting = items.value.filter((item) => item.status === "waiting")
      .length;
    const uploading = items.value.filter((item) => item.status === "uploading")
      .length;
    const completed = items.value.filter((item) => item.status === "completed")
      .length;
    const error = items.value.filter((item) => item.status === "error").length;

    return {
      total,
      waiting,
      uploading,
      completed,
      error,
    };
  });

  // キューが空かどうか
  const isEmpty = computed(() => items.value.length === 0);

  /**
   * ファイルをキューに追加
   *
   * @param files - 追加するファイル情報の配列
   */
  function enqueue(files: { filePath: string; fileName: string }[]): void {
    const newItems: QueueItem[] = files.map((file) => ({
      id: ++queueItemIdCounter,
      filePath: file.filePath,
      fileName: file.fileName,
      status: "waiting",
    }));

    items.value.push(...newItems);
  }

  /**
   * 現在のアイテムのステータスを更新
   *
   * @param status - 新しいステータス
   */
  function updateCurrentStatus(status: QueueItemStatus): void {
    if (!currentItem.value) return;

    const item = items.value.find((i) => i.id === currentItem.value!.id);
    if (item) {
      item.status = status;
    }
    currentItem.value.status = status;
  }

  /**
   * 現在のアイテムをエラー状態にする
   *
   * @param error - エラーメッセージ
   */
  function markCurrentError(error: string): void {
    if (!currentItem.value) return;

    const item = items.value.find((i) => i.id === currentItem.value!.id);
    if (item) {
      item.status = "error";
      item.error = error;
    }

    currentItem.value.status = "error";
    currentItem.value.error = error;
    currentItem.value = null;
  }

  /**
   * 現在のアイテムを完了状態にする
   *
   * @param assetId - アップロード完了後のアセットID
   */
  function markCurrentCompleted(assetId: string): void {
    if (!currentItem.value) return;

    const item = items.value.find((i) => i.id === currentItem.value!.id);
    if (item) {
      item.status = "completed";
      item.assetId = assetId;
    }

    currentItem.value.status = "completed";
    currentItem.value.assetId = assetId;
    currentItem.value = null;
  }

  /**
   * 次のアイテムを取得して処理開始
   *
   * 待機中のアイテムを1つ取り出し、アップロード中状態にする
   *
   * @returns 次のアイテム、またはキューが空ならnull
   */
  function startNext(): QueueItem | null {
    const nextItem = items.value.find((item) => item.status === "waiting");

    if (!nextItem) {
      isProcessing.value = false;
      return null;
    }

    nextItem.status = "uploading";
    currentItem.value = nextItem;
    isProcessing.value = true;

    return nextItem;
  }

  /**
   * 特定のアイテムをキャンセル
   *
   * 待機中のアイテムのみキャンセル可能
   *
   * @param id - キャンセルするアイテムのID
   */
  function cancel(id: number): void {
    const index = items.value.findIndex(
      (item) => item.id === id && item.status === "waiting",
    );

    if (index !== -1) {
      items.value.splice(index, 1);
    }
  }

  /**
   * キューをクリア
   *
   * すべてのアイテムを削除し、状態をリセット
   */
  function clear(): void {
    items.value = [];
    currentItem.value = null;
    isProcessing.value = false;
  }

  return {
    items,
    currentItem,
    stats,
    isEmpty,
    isProcessing,
    enqueue,
    updateCurrentStatus,
    markCurrentError,
    markCurrentCompleted,
    startNext,
    cancel,
    clear,
  };
}
