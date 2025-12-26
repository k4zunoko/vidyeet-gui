/**
 * アプリケーション状態の型定義
 */

/** アプリケーションの画面状態 */
export type AppScreen = 'initializing' | 'login' | 'library';

/** 動画アイテム（UI表示用） */
export interface VideoItem {
  assetId: string;
  playbackId: string | null;
}

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
  action?: 'retry' | 'login';
}
