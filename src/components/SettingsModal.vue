<script setup lang="ts">
/**
 * 設定モーダル
 *
 * アプリケーション設定を管理するモーダルダイアログ
 * - ログアウト機能
 * - アップデート（手動確認・ダウンロード・再起動）
 * - アプリ情報表示（バージョン、CLIパス）
 *
 * UX原則:
 * - モーダルダイアログ: シンプルな設定項目に適している（NN/g）
 * - 視覚的階層: カテゴリごとにグループ化して認知負荷を削減
 * - エスケープルート: Esc、オーバーレイクリック、×ボタンの3通り
 *
 * @see docs/UI_SPEC.md - 設定画面仕様
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  isIpcError,
  type UpdateProgress,
  type UpdateStatus,
  type UpdateStatusPayload,
} from '../../electron/types/ipc';

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

type LocalUpdateStatus = 'idle' | UpdateStatus;

const updateStatus = ref<LocalUpdateStatus>('idle');
const updateInfo = ref<unknown | null>(null);
const updateProgress = ref<UpdateProgress | null>(null);
const updateErrorMessage = ref<string | null>(null);
const lastCheckedAt = ref<Date | null>(null);
const isInstalling = ref(false);

const isChecking = computed(() => updateStatus.value === 'checking-for-update');
const isDownloading = computed(() => updateStatus.value === 'download-progress');
const isUpdateAvailable = computed(() => updateStatus.value === 'update-available');
const isUpdateDownloaded = computed(() => updateStatus.value === 'update-downloaded');
const canCheckForUpdates = computed(
  () =>
    !isChecking.value &&
    !isDownloading.value &&
    !isInstalling.value &&
    updateStatus.value !== 'update-downloaded'
);

const updateStatusVariant = computed(() => {
  switch (updateStatus.value) {
    case 'update-not-available':
    case 'update-downloaded':
      return 'success';
    case 'update-available':
      return 'highlight';
    case 'error':
      return 'error';
    default:
      return 'neutral';
  }
});

const updateStatusLabel = computed(() => {
  switch (updateStatus.value) {
    case 'checking-for-update':
      return '確認中';
    case 'update-available':
      return '更新あり';
    case 'update-not-available':
      return '最新';
    case 'download-progress':
      return 'ダウンロード中';
    case 'update-downloaded':
      return '準備完了';
    case 'error':
      return 'エラー';
    default:
      return '未確認';
  }
});

const updateStatusDescription = computed(() => {
  switch (updateStatus.value) {
    case 'checking-for-update':
      return '最新バージョンを確認しています。';
    case 'update-available':
      return '新しいバージョンが見つかりました。';
    case 'update-not-available':
      return 'すでに最新のバージョンです。';
    case 'download-progress':
      return '更新ファイルをダウンロードしています。';
    case 'update-downloaded':
      return 'インストールの準備ができました。再起動で更新が適用されます。';
    case 'error':
      return (
        updateErrorMessage.value ??
        '更新の処理に失敗しました。時間をおいて再試行してください。'
      );
    default:
      return '手動で更新を確認できます。';
  }
});

const updateVersionLabel = computed(() => {
  const version = getUpdateVersion(updateInfo.value);
  return version ? `新しいバージョン: ${version}` : null;
});

const downloadPercent = computed(() => {
  if (!updateProgress.value || !Number.isFinite(updateProgress.value.percent)) {
    return null;
  }

  return Math.min(100, Math.max(0, Math.round(updateProgress.value.percent)));
});

const downloadSummary = computed(() => {
  if (!updateProgress.value) {
    return null;
  }

  const { transferred, total, bytesPerSecond } = updateProgress.value;
  const parts: string[] = [];

  if (Number.isFinite(transferred) && Number.isFinite(total) && total > 0) {
    parts.push(`${formatBytes(transferred)} / ${formatBytes(total)}`);
  }

  if (Number.isFinite(bytesPerSecond) && bytesPerSecond > 0) {
    parts.push(`${formatBytes(bytesPerSecond)}/s`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
});

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

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const base = 1024;
  let value = bytes;
  let unitIndex = 0;

  while (value >= base && unitIndex < units.length - 1) {
    value /= base;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getUpdateVersion(info: unknown): string | null {
  if (!info || typeof info !== 'object') {
    return null;
  }

  const data = info as Record<string, unknown>;
  const version =
    (typeof data.version === 'string' && data.version) ||
    (typeof data.releaseName === 'string' && data.releaseName) ||
    (typeof data.tag === 'string' && data.tag) ||
    null;

  return version && version.trim().length > 0 ? version : null;
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

function setUpdateError(message: string) {
  updateStatus.value = 'error';
  updateErrorMessage.value = message;
  updateProgress.value = null;
  isInstalling.value = false;
}

function setUpdateErrorFromIpc(message?: string) {
  const resolvedMessage =
    message ??
    '更新の処理に失敗しました。ネットワークを確認して再試行してください。';
  setUpdateError(resolvedMessage);
}

async function handleCheckForUpdates() {
  if (!canCheckForUpdates.value) {
    return;
  }

  updateStatus.value = 'checking-for-update';
  updateErrorMessage.value = null;
  updateInfo.value = null;
  updateProgress.value = null;
  lastCheckedAt.value = new Date();

  const result = await window.updater.checkForUpdates();

  if (isIpcError(result)) {
    if (result.code === 'AUTO_UPDATE_DISABLED') {
      setUpdateError('自動更新はパッケージ版のみ対応しています。');
      return;
    }

    setUpdateErrorFromIpc(result.message);
  }
}

async function handleDownloadUpdate() {
  if (!isUpdateAvailable.value || isDownloading.value) {
    return;
  }

  updateStatus.value = 'download-progress';
  updateErrorMessage.value = null;
  updateProgress.value = null;

  const result = await window.updater.downloadUpdate();

  if (isIpcError(result)) {
    if (result.code === 'AUTO_UPDATE_DISABLED') {
      setUpdateError('自動更新はパッケージ版のみ対応しています。');
      return;
    }

    setUpdateErrorFromIpc(result.message);
  }
}

async function handleInstallUpdate() {
  if (!isUpdateDownloaded.value || isInstalling.value) {
    return;
  }

  isInstalling.value = true;
  updateErrorMessage.value = null;

  const result = await window.updater.quitAndInstall();

  if (isIpcError(result)) {
    isInstalling.value = false;
    if (result.code === 'AUTO_UPDATE_DISABLED') {
      setUpdateError('自動更新はパッケージ版のみ対応しています。');
      return;
    }

    setUpdateErrorFromIpc(result.message);
  }
}

function handleUpdateStatus(payload: UpdateStatusPayload) {
  updateStatus.value = payload.status;
  updateInfo.value = payload.info ?? updateInfo.value;

  if (payload.status === 'download-progress') {
    updateProgress.value = payload.progress ?? updateProgress.value;
  } else {
    updateProgress.value = payload.progress ?? null;
  }

  if (payload.status === 'error') {
    updateErrorMessage.value =
      payload.error ??
      '更新の処理に失敗しました。ネットワークを確認して再試行してください。';
    isInstalling.value = false;
  } else {
    updateErrorMessage.value = null;
  }

  if (
    payload.status === 'update-available' ||
    payload.status === 'update-not-available' ||
    payload.status === 'error'
  ) {
    lastCheckedAt.value = new Date();
  }
}

/**
 * Escキーで閉じる
 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    handleClose();
  }
}

let unsubscribeUpdateStatus: (() => void) | null = null;

onMounted(() => {
  loadCliPath();
  document.addEventListener('keydown', handleKeydown);
  unsubscribeUpdateStatus = window.updater.onStatus(handleUpdateStatus);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown);
  if (unsubscribeUpdateStatus) {
    unsubscribeUpdateStatus();
  }
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
          <!-- アップデートセクション -->
          <section class="settings-section settings-section--update">
            <div class="settings-section-header">
              <div class="settings-section-heading">
                <h3 class="settings-section-title settings-section-title--prominent">
                  アップデート
                </h3>
                <p class="settings-section-subtitle">
                  必要なときに手動で更新を確認できます。
                </p>
              </div>
              <div class="settings-section-actions">
                <button
                  class="settings-action-button settings-action-button--ghost"
                  @click="handleCheckForUpdates"
                  :disabled="!canCheckForUpdates"
                >
                  <span
                    v-if="isChecking"
                    class="settings-spinner"
                    aria-hidden="true"
                  ></span>
                  <span>{{ isChecking ? '確認中...' : '更新を確認' }}</span>
                </button>
              </div>
            </div>
            <div class="settings-update-card" :data-variant="updateStatusVariant">
              <div class="settings-update-row">
                <div class="settings-update-status">
                  <span
                    class="settings-update-badge"
                    :data-variant="updateStatusVariant"
                  >
                    {{ updateStatusLabel }}
                  </span>
                  <span v-if="updateVersionLabel" class="settings-update-version">
                    {{ updateVersionLabel }}
                  </span>
                </div>
                <span v-if="lastCheckedAt" class="settings-update-meta">
                  最終確認: {{ formatDateTime(lastCheckedAt) }}
                </span>
              </div>
              <p class="settings-update-description">{{ updateStatusDescription }}</p>

              <div v-if="isDownloading" class="settings-update-progress">
                <div class="settings-progress-header">
                  <span>ダウンロード進捗</span>
                  <span v-if="downloadPercent !== null">
                    {{ downloadPercent }}%
                  </span>
                </div>
                <progress
                  class="settings-progress-bar"
                  max="100"
                  :value="downloadPercent ?? 0"
                  aria-label="更新ダウンロードの進捗"
                ></progress>
                <div class="settings-progress-meta">
                  <span v-if="downloadSummary">{{ downloadSummary }}</span>
                  <span class="settings-progress-note">
                    この画面を閉じてもダウンロードは継続します。
                  </span>
                </div>
              </div>

              <div
                v-if="isUpdateAvailable || isUpdateDownloaded || updateStatus === 'error'"
                class="settings-update-actions"
              >
                <button
                  v-if="isUpdateAvailable"
                  class="settings-action-button settings-action-button--primary"
                  @click="handleDownloadUpdate"
                  :disabled="isDownloading"
                >
                  ダウンロード
                </button>
                <button
                  v-else-if="isUpdateDownloaded"
                  class="settings-action-button settings-action-button--primary"
                  @click="handleInstallUpdate"
                  :disabled="isInstalling"
                >
                  <span
                    v-if="isInstalling"
                    class="settings-spinner"
                    aria-hidden="true"
                  ></span>
                  <span>{{ isInstalling ? '再起動中...' : 'インストールして再起動' }}</span>
                </button>
                <button
                  v-else-if="updateStatus === 'error'"
                  class="settings-action-button settings-action-button--ghost"
                  @click="handleCheckForUpdates"
                  :disabled="!canCheckForUpdates"
                >
                  再試行
                </button>
              </div>
            </div>
          </section>

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

.settings-section-title--prominent {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
  text-transform: none;
  letter-spacing: normal;
}

.settings-section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.settings-section-heading {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.settings-section-subtitle {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.settings-section-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.settings-action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s, opacity 0.2s;
  min-height: 40px;
}

.settings-action-button--primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.settings-action-button--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.settings-action-button--ghost:hover:not(:disabled) {
  background: var(--color-surface-hover);
  border-color: var(--color-primary-alpha);
}

.settings-action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.settings-update-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.settings-update-card[data-variant='highlight'] {
  border-color: var(--color-primary);
  background: rgba(250, 80, 181, 0.08);
  box-shadow: 0 0 0 1px var(--color-primary-alpha);
}

.settings-update-card[data-variant='success'] {
  border-color: var(--color-success);
  background: rgba(81, 207, 102, 0.12);
}

.settings-update-card[data-variant='error'] {
  border-color: var(--color-error);
  background: var(--color-error-bg);
}

.settings-update-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.settings-update-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.settings-update-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text);
  background: var(--color-border);
}

.settings-update-badge[data-variant='highlight'] {
  color: var(--color-primary);
  background: var(--color-primary-alpha);
}

.settings-update-badge[data-variant='success'] {
  color: var(--color-success);
  background: rgba(81, 207, 102, 0.2);
}

.settings-update-badge[data-variant='error'] {
  color: var(--color-error);
  background: var(--color-error-bg);
}

.settings-update-version {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
}

.settings-update-description {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text);
}

.settings-update-meta {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.settings-update-progress {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.settings-progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.settings-progress-bar {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  appearance: none;
}

.settings-progress-bar::-webkit-progress-bar {
  background: var(--color-surface-dark);
  border-radius: 999px;
}

.settings-progress-bar::-webkit-progress-value {
  background: linear-gradient(
    90deg,
    var(--color-primary),
    var(--color-primary-hover)
  );
  border-radius: 999px;
}

.settings-progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.settings-progress-note {
  color: var(--color-text-muted);
}

.settings-update-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.settings-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: settings-spin 0.8s linear infinite;
}

@keyframes settings-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
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
