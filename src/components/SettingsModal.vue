<script setup lang="ts">
/**
 * 設定モーダル
 *
 * アプリケーション設定を管理するモーダルダイアログ
 * - ログアウト機能
 * - アプリ情報表示（バージョン、CLIパス）
 *
 * UX原則:
 * - モーダルダイアログ: シンプルな設定項目に適している（NN/g）
 * - 視覚的階層: カテゴリごとにグループ化して認知負荷を削減
 * - エスケープルート: Esc、オーバーレイクリック、×ボタンの3通り
 *
 * @see docs/UI_SPEC.md - 設定画面仕様
 */
import { ref, onMounted, onBeforeUnmount } from 'vue';

defineProps<{
  /** モーダルの開閉状態 */
  isOpen: boolean;
}>();

const emit = defineEmits<{
  /** 閉じる要求 */
  close: [];
  /** ログアウト要求 */
  logout: [];
}>();

// アプリケーション情報
import packageJson from '../../package.json';
const appVersion = ref(packageJson.version);
const cliPath = ref('読み込み中...');

/**
 * CLIパスを取得
 */
async function loadCliPath() {
  try {
    // CLIパスを取得するAPIがある場合はここで取得
    // 現在は仮実装としてpackage.jsonから取得
    cliPath.value = 'bin/vidyeet-cli.exe';
  } catch {
    cliPath.value = '取得できませんでした';
  }
}

/**
 * モーダルを閉じる
 */
function handleClose() {
  emit('close');
}

/**
 * オーバーレイクリックで閉じる
 */
function handleOverlayClick() {
  emit('close');
}

/**
 * ログアウト
 * UX原則: 設定画面を開くこと自体が意図確認なので、確認ダイアログは不要
 */
function handleLogout() {
  emit('logout');
}

/**
 * Escキーで閉じる
 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    handleClose();
  }
}

onMounted(() => {
  loadCliPath();
  document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <!-- オーバーレイ -->
    <Transition name="settings-fade">
      <div
        v-if="isOpen"
        class="settings-overlay"
        @click="handleOverlayClick"
      />
    </Transition>

    <!-- モーダル本体 -->
    <Transition name="settings-modal">
      <div
        v-if="isOpen"
        class="settings-modal"
        role="dialog"
        aria-labelledby="settings-title"
        aria-modal="true"
      >
        <!-- ヘッダー -->
        <div class="settings-header">
          <h2 id="settings-title" class="settings-title">設定</h2>
          <button
            class="settings-close"
            @click="handleClose"
            aria-label="閉じる"
            title="閉じる"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M4 4l8 8M12 4l-8 8"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>

        <!-- コンテンツ -->
        <div class="settings-content">
          <!-- アカウントセクション -->
          <section class="settings-section">
            <h3 class="settings-section-title">アカウント</h3>
            <button
              class="settings-logout-button"
              @click="handleLogout"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 3h8v2H5v10h6v2H3V3zm10 4l4 3-4 3v-2H8V9h5V7z"/>
              </svg>
              <span>ログアウト</span>
            </button>
          </section>

          <!-- アプリケーション情報セクション -->
          <section class="settings-section">
            <h3 class="settings-section-title">アプリケーション情報</h3>
            <div class="settings-info-group">
              <div class="settings-info-item">
                <span class="settings-info-label">バージョン</span>
                <span class="settings-info-value">{{ appVersion }}</span>
              </div>
              <div class="settings-info-item">
                <span class="settings-info-label">CLI パス</span>
                <span class="settings-info-value settings-info-value--path">{{ cliPath }}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* オーバーレイ */
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 200;
}

.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 0.2s ease;
}

.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
}

/* モーダル本体 */
.settings-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90%;
  max-width: 480px;
  max-height: 70vh;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
  z-index: 201;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-modal-enter-active,
.settings-modal-leave-active {
  transition: 
    opacity 0.2s ease,
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.settings-modal-enter-from,
.settings-modal-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.95);
}

/* ヘッダー */
.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.settings-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
}

.settings-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s, color 0.15s;
}

.settings-close:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

/* コンテンツ */
.settings-content {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* セクション */
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.settings-section-title {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ログアウトボタン */
.settings-logout-button {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-error, #ef4444);
  background: transparent;
  border: 1px solid var(--color-error, #ef4444);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  /* Fitts' Law: 十分なタッチターゲット */
  min-height: 44px;
}

.settings-logout-button:hover {
  background: var(--color-error, #ef4444);
  color: white;
}

.settings-logout-button svg {
  flex-shrink: 0;
}

/* 情報グループ */
.settings-info-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-bg);
  border-radius: 8px;
}

.settings-info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.settings-info-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.settings-info-value {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  word-break: break-word;
}

.settings-info-value--path {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

/* スクロールバー */
.settings-content::-webkit-scrollbar {
  width: 8px;
}

.settings-content::-webkit-scrollbar-track {
  background: transparent;
}

.settings-content::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 4px;
}

.settings-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-muted);
}
</style>
