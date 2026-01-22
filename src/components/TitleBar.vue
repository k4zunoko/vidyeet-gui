<script setup lang="ts">
/**
 * カスタムタイトルバー
 *
 * フレームレスウィンドウ用のタイトルバー
 * - ドラッグ領域
 * - リロード / メニュー / 最小化 / 最大化 / 閉じる ボタン
 */
import { ref, onMounted, onUnmounted } from 'vue';

defineProps<{
  /** リロードボタン表示 */
  showReload?: boolean;
  /** 設定ボタン表示 */
  showSettings?: boolean;
}>();

const emit = defineEmits<{
  /** リロード要求 */
  reload: [];
  /** 設定画面を開く要求 */
  openSettings: [];
}>();

// 最大化状態
const isMaximized = ref(false);

// 最大化状態を更新
async function updateMaximizedState() {
  isMaximized.value = await window.windowControl.isMaximized();
}

// ウィンドウ操作
function handleMinimize() {
  window.windowControl.minimize();
}

async function handleMaximize() {
  await window.windowControl.maximize();
  await updateMaximizedState();
}

function handleClose() {
  window.windowControl.close();
}

function handleReload() {
  emit('reload');
}

function handleOpenSettings() {
  emit('openSettings');
}

// リサイズイベントで最大化状態を更新
function handleResize() {
  updateMaximizedState();
}

onMounted(() => {
  updateMaximizedState();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<template>
  <div class="title-bar">
    <!-- ドラッグ領域 -->
    <div class="drag-region">
      <span class="app-title">Vidyeet</span>
    </div>

    <!-- ウィンドウコントロール -->
    <div class="window-controls">
      <!-- リロード -->
      <button
        v-if="showReload"
        class="control-button reload"
        title="リロード"
        @click="handleReload"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M10.5 6c0 2.485-2.015 4.5-4.5 4.5S1.5 8.485 1.5 6 3.515 1.5 6 1.5c1.38 0 2.61.62 3.435 1.595L8.25 4.5h3V1.5l-1.19 1.19A5.478 5.478 0 006 .5C2.965.5.5 2.965.5 6s2.465 5.5 5.5 5.5 5.5-2.465 5.5-5.5h-1z"/>
        </svg>
      </button>

      <!-- 設定 -->
      <button
        v-if="showSettings"
        class="control-button settings"
        title="設定"
        @click="handleOpenSettings"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" clip-rule="evenodd"
            d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54a6.993 6.993 0 0 1 1.93-1.115l.33-1.652ZM10 13a3 3 0 1 0 0-6a3 3 0 0 0 0 6Z"/>
        </svg>
      </button>

      <!-- 最小化 -->
      <button
        class="control-button minimize"
        title="最小化"
        @click="handleMinimize"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <rect x="2" y="5.5" width="8" height="1" />
        </svg>
      </button>

      <!-- 最大化/元に戻す -->
      <button
        class="control-button maximize"
        :title="isMaximized ? '元に戻す' : '最大化'"
        @click="handleMaximize"
      >
        <svg v-if="isMaximized" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <!-- 元に戻すアイコン -->
          <path d="M3.5 1v1.5h6v6H11V1H3.5zM1 3.5v7.5h7.5V3.5H1zm1 1h5.5v5.5H2V4.5z"/>
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <!-- 最大化アイコン -->
          <rect x="1.5" y="1.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/>
        </svg>
      </button>

      <!-- 閉じる -->
      <button
        class="control-button close"
        title="閉じる"
        @click="handleClose"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M1.5 2.2L2.2 1.5 6 5.3 9.8 1.5l.7.7L6.7 6l3.8 3.8-.7.7L6 6.7 2.2 10.5l-.7-.7L5.3 6 1.5 2.2z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.title-bar {
  display: flex;
  align-items: center;
  height: 32px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  user-select: none;
}

.drag-region {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  padding-left: 12px;
  -webkit-app-region: drag;
}

.app-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  letter-spacing: 0.5px;
}

.window-controls {
  display: flex;
  height: 100%;
  -webkit-app-region: no-drag;
}

.control-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.control-button:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.control-button.close:hover {
  background: #e81123;
  color: white;
}

.control-button svg {
  width: 12px;
  height: 12px;
}
</style>
