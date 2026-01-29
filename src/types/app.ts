/**
 * アプリケーション状態の型定義
 */

import type { AssetItem } from '../../electron/types/ipc';

/** アプリケーションの画面状態 */
export type AppScreen = "initializing" | "login" | "library";

/** 動画アイテム（UI表示用） - AssetItemのエイリアス */
export type VideoItem = AssetItem;

/** アプリケーション全体の状態 */
export interface AppState {
  /** 現在の画面 */
  screen: AppScreen;
  /** 認証済みかどうか */
  isAuthenticated: boolean;
  /** 動画一覧 */
  videos: VideoItem[];
  /** 選択中の動画 */
  selectedVideo: VideoItem | null;
  /** グローバルエラー */
  error: AppError | null;
  /** ローディング状態 */
  isLoading: boolean;
}

/** アプリケーションエラー */
export interface AppError {
  message: string;
  action?: "retry" | "login";
}

// =============================================================================
// トースト通知
// =============================================================================

/** トースト通知のタイプ */
export type ToastType = "success" | "error" | "info";

/** トースト通知アイテム */
export interface ToastItem {
  /** 一意なID */
  id: number;
  /** 通知タイプ */
  type: ToastType;
  /** 表示メッセージ */
  message: string;
  /** 自動消去までの時間（ミリ秒） */
  duration: number;
}

// =============================================================================
// アップロードキュー
// =============================================================================

/** アップロードキューアイテムのステータス */
export type QueueItemStatus = "waiting" | "uploading" | "completed" | "error";

/** アップロードキューアイテム */
export interface QueueItem {
  /** 一意なID */
  id: number;
  /** ファイルの絶対パス */
  filePath: string;
  /** 表示用ファイル名 */
  fileName: string;
  /** 現在のステータス */
  status: QueueItemStatus;
  /** エラーメッセージ（errorステータス時のみ） */
  error?: string;
  /** アップロード完了後のアセットID（completedステータス時のみ） */
  assetId?: string;
}

/** アップロードキューの統計情報 */
export interface QueueStats {
  /** 総アイテム数 */
  total: number;
  /** 待機中の数 */
  waiting: number;
  /** アップロード中の数 */
  uploading: number;
  /** 完了した数 */
  completed: number;
  /** エラーの数 */
  error: number;
}
