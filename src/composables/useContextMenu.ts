/**
 * コンテキストメニュー状態管理
 *
 * 動画のコンテキストメニュー（右クリックメニュー）の表示状態と操作を管理するcomposable
 *
 * 設計方針:
 * - グローバル状態: アプリケーション全体で1つのコンテキストメニューを管理
 * - 位置管理: マウスイベントから座標を取得して表示位置を決定
 * - 動画参照: メニュー内の操作（削除など）で動画情報を参照
 */

import { ref, type Ref } from "vue";
import type { VideoItem } from "../types/app";

/**
 * コンテキストメニューの状態
 */
export interface ContextMenuState {
  /** メニューが開いているかどうか */
  isOpen: boolean;
  /** メニューが関連する動画（nullの場合はメニューが閉じている） */
  video: VideoItem | null;
  /** メニューの表示位置（X座標） */
  x: number;
  /** メニューの表示位置（Y座標） */
  y: number;
}

/**
 * useContextMenu の戻り値型
 */
export interface UseContextMenu {
  /** コンテキストメニューの状態 */
  state: Ref<ContextMenuState>;
  /** コンテキストメニューを表示 */
  showContextMenu: (event: MouseEvent, video: VideoItem) => void;
  /** コンテキストメニューを閉じる */
  closeContextMenu: () => void;
}

/**
 * コンテキストメニュー状態管理のcomposable
 *
 * @returns コンテキストメニューの状態と操作メソッド
 */
export function useContextMenu(): UseContextMenu {
  // コンテキストメニューの状態
  const state = ref<ContextMenuState>({
    isOpen: false,
    video: null,
    x: 0,
    y: 0,
  });

  /**
   * コンテキストメニューを表示
   *
   * マウスイベントから座標を取得し、メニューを表示する
   *
   * @param event - マウスイベント（座標取得用）
   * @param video - メニューが関連する動画
   */
  function showContextMenu(event: MouseEvent, video: VideoItem): void {
    state.value = {
      isOpen: true,
      video,
      x: event.clientX,
      y: event.clientY,
    };
  }

  /**
   * コンテキストメニューを閉じる
   */
  function closeContextMenu(): void {
    state.value.isOpen = false;
  }

  return {
    state,
    showContextMenu,
    closeContextMenu,
  };
}
