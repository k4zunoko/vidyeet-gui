<script setup lang="ts">
/**
 * アプリケーションルート
 *
 * 起動時の認証チェック → 画面切り替え
 * フレームレスウィンドウ対応（カスタムタイトルバー）
 * @see docs/UI_SPEC.md - 起動時状態遷移
 */
import { ref, onMounted } from 'vue';
import type { AppScreen, VideoItem } from './types/app';
import { isIpcError } from '../electron/types/ipc';
import TitleBar from './components/TitleBar.vue';
import SideDrawer from './components/SideDrawer.vue';
import LoginView from './features/auth/LoginView.vue';
import LibraryView from './features/library/LibraryView.vue';
import VideoPlayer from './features/player/VideoPlayer.vue';

// 現在の画面
const currentScreen = ref<AppScreen>('initializing');

// 選択中の動画
const selectedVideo = ref<VideoItem | null>(null);

// 初期化エラー
const initError = ref<string | null>(null);

// ドロワー表示状態
const isDrawerOpen = ref(false);

// LibraryViewへの参照（reload用）
const libraryRef = ref<InstanceType<typeof LibraryView> | null>(null);

/**
 * 認証状態をチェック
 */
async function checkAuth() {
  currentScreen.value = 'initializing';
  initError.value = null;

  try {
    const result = await window.vidyeet.status();

    if (isIpcError(result)) {
      // CLI エラー: ログイン画面へ（CLI未設定の可能性）
      initError.value = result.message;
      currentScreen.value = 'login';
      return;
    }

    if (result.isAuthenticated) {
      currentScreen.value = 'library';
    } else {
      currentScreen.value = 'login';
    }
  } catch (err) {
    initError.value = '初期化に失敗しました。アプリを再起動してください。';
    currentScreen.value = 'login';
  }
}

/**
 * ログイン成功時
 */
function handleLoginSuccess() {
  currentScreen.value = 'library';
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
  currentScreen.value = 'login';
  isDrawerOpen.value = false;
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
 * メニュー開閉
 */
function toggleDrawer() {
  isDrawerOpen.value = !isDrawerOpen.value;
}

/**
 * ドロワーを閉じる
 */
function closeDrawer() {
  isDrawerOpen.value = false;
}

onMounted(() => {
  checkAuth();
});
</script>

<template>
  <div id="app">
    <!-- カスタムタイトルバー -->
    <TitleBar
      :show-reload="currentScreen === 'library'"
      :show-menu="currentScreen === 'library'"
      @reload="handleReload"
      @toggle-menu="toggleDrawer"
    />

    <!-- メインコンテンツ領域（タイトルバー分の高さを引く） -->
    <div class="app-content">
      <!-- 初期化中 -->
      <div v-if="currentScreen === 'initializing'" class="initializing-screen">
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
          />
        </aside>

        <!-- メインエリア: プレイヤー -->
        <main class="main-content">
          <VideoPlayer :video="selectedVideo" />
        </main>
      </div>

      <!-- ドロワー -->
      <SideDrawer
        :is-open="isDrawerOpen"
        @close="closeDrawer"
        @logout="handleLogout"
      />
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
  to { transform: rotate(360deg); }
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
  width: 360px;
  min-width: 280px;
  max-width: 50%;
  height: 100%;
  border-right: 1px solid var(--color-border);
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
</style>

