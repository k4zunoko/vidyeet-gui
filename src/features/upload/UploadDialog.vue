<script setup lang="ts">
/**
 * アップロードダイアログ
 *
 * ノンモーダル アップロード進捗ダイアログ（画面右下固定）
 * useUploadDialog / useUploadQueue を内部で保持し、
 * 親からは files prop 経由でファイルを受け取る。
 *
 * @see docs/UX_PSYCHOLOGY.md
 */
import { watch } from "vue";
import { useUploadDialog, type FileWithPath } from "../../composables/useUploadDialog";
import type { ToastType } from "../../types/app";

// =============================================================================
// Props / Emits
// =============================================================================
const props = defineProps<{
  /** 親から渡されるファイル（ドラッグアンドドロップ・ファイル選択） */
  files?: FileWithPath[];
  /** 親の showToast 関数（App.vue の ToastNotification に表示するため） */
  showToast: (type: ToastType, message: string, duration?: number) => void;
}>();
const emit = defineEmits<{
  /** アップロード完了通知（親がライブラリを更新する） */
  "upload-complete": [];
}>();

// =============================================================================
// Composables（コンポーネント内で完結）
// =============================================================================
const uploadDialog = useUploadDialog({
  showToast: props.showToast,
  onUploadComplete: () => {
    emit("upload-complete");
  },
});

// =============================================================================
// ファイル受信ウォッチャー
// =============================================================================

/**
 * 親から files prop が更新されたとき（ドラッグ&ドロップ / ファイル選択）
 * キューに追加して処理を開始する。
 */
watch(
  () => props.files,
  async (newFiles) => {
    if (!newFiles || newFiles.length === 0) return;
    await uploadDialog.handleMultipleFiles(newFiles);
  },
  { deep: false },
);

// =============================================================================
// defineExpose（親が直接呼び出せるメソッド）
// =============================================================================
defineExpose({
  handleMultipleFiles: uploadDialog.handleMultipleFiles,
});
</script>

<template>
  <!-- アップロードダイアログ -->
  <!-- ノンモーダル アップロード進捗ダイアログ（画面右下固定） -->
  <Teleport to="body">
    <Transition name="upload-slide">
      <div
        v-if="uploadDialog.uploadDialogState.value.isOpen"
        class="upload-dialog-nonmodal"
        :class="{
          'upload-dialog-nonmodal--minimized':
            uploadDialog.uploadDialogState.value.isMinimized,
        }"
        role="dialog"
        aria-labelledby="upload-dialog-title"
      >
        <!-- 最小化状態: コンパクトバー -->
        <!-- UX原則: エラーは目立つ視覚的指標で表示（NN/g）、視覚的階層でエラーアイコンを最も目立たせる -->
        <div
          v-if="uploadDialog.uploadDialogState.value.isMinimized"
          class="upload-minimized-bar"
          :class="{
            'upload-minimized-bar--error':
              uploadDialog.uploadDialogState.value.errorMessage,
          }"
          @click="uploadDialog.restoreUploadDialog"
          :title="
            uploadDialog.uploadDialogState.value.errorMessage
              ? $t('app.upload.showDetails')
              : $t('app.upload.expand')
          "
        >
          <!-- エラー時: エラーアイコン -->
          <svg
            v-if="uploadDialog.uploadDialogState.value.errorMessage"
            class="upload-minimized-icon upload-minimized-icon--error"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="10"
              cy="10"
              r="9"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M10 6V11"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
            <circle
              cx="10"
              cy="14"
              r="1"
              fill="currentColor"
            />
          </svg>

          <!-- 進行中: スピナー -->
          <div
            v-else-if="uploadDialog.uploadDialogState.value.isUploading"
            class="upload-minimized-spinner"
          ></div>

          <!-- 成功時: チェックマーク（短時間表示） -->
          <svg
            v-else-if="
              uploadDialog.uploadDialogState.value.phase === 'completed'
            "
            class="upload-minimized-icon upload-minimized-icon--success"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="10"
              cy="10"
              r="9"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M6 10L8.5 12.5L14 7"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>

          <span class="upload-minimized-text">
            {{
              uploadDialog.uploadDialogState.value.errorMessage
                ? $t('app.upload.failed')
                : uploadDialog.uploadDialogState.value.fileName
            }}
          </span>

          <!-- 進捗率: エラー時は非表示（認知負荷を減らす） -->
          <!-- 進捗率または件数: エラー時は非表示 -->
          <span
            v-if="!uploadDialog.uploadDialogState.value.errorMessage"
            class="upload-minimized-percent"
          >
            <template
              v-if="uploadDialog.uploadQueue.stats.value.total > 1"
            >
              {{
                uploadDialog.uploadQueue.stats.value.completed +
                uploadDialog.uploadQueue.stats.value.uploading
              }}/{{ uploadDialog.uploadQueue.stats.value.total }}
            </template>
            <template
              v-else-if="uploadDialog.uploadDialogState.value.isUploading"
            >
              {{ uploadDialog.uploadDialogState.value.progressPercent }}%
            </template>
          </span>
        </div>

        <!-- 通常状態: フル表示 -->
        <div v-else class="upload-dialog-content">
          <div class="upload-dialog-header">
            <h2
              id="upload-dialog-title"
              class="upload-dialog-title"
            >
              {{
                uploadDialog.uploadDialogState.value.errorMessage
                  ? $t('app.upload.error')
                  : uploadDialog.uploadQueue.stats.value.total > 1
                    ? $t('app.upload.inProgress') + ` (${uploadDialog.uploadQueue.stats.value.completed + uploadDialog.uploadQueue.stats.value.uploading}/${uploadDialog.uploadQueue.stats.value.total})`
                    : $t('app.upload.inProgress')
              }}
            </h2>
            <div class="upload-dialog-controls">
              <button
                v-if="!uploadDialog.uploadDialogState.value.errorMessage"
                class="upload-control-button"
                @click="uploadDialog.minimizeUploadDialog"
                :aria-label="$t('app.upload.minimizing')"
                :title="$t('app.upload.minimizing')"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M3 8h10"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
              <button
                v-if="uploadDialog.uploadDialogState.value.isUploading && !uploadDialog.uploadDialogState.value.errorMessage"
                class="upload-control-button upload-cancel-button"
                @click="uploadDialog.cancelCurrentUpload()"
                :disabled="uploadDialog.uploadDialogState.value.isCancelling"
                :aria-label="$t('app.upload.cancel')"
                :title="uploadDialog.uploadDialogState.value.isCancelling ? $t('app.upload.cancelling') : $t('app.upload.cancel')"
              >
                <svg
                  v-if="!uploadDialog.uploadDialogState.value.isCancelling"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    stroke="currentColor"
                    stroke-width="1.5"
                  />
                  <path
                    d="M10 6L6 10M6 6l4 4"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
                <svg
                  v-else
                  class="spinner"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    stroke="currentColor"
                    stroke-width="2"
                    fill="none"
                    stroke-dasharray="18.85 18.85"
                    stroke-linecap="round"
                  >
                    <animateTransform
                      attributeName="transform"
                      type="rotate"
                      from="0 8 8"
                      to="360 8 8"
                      dur="1s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </svg>
              </button>
              <button
                v-if="uploadDialog.uploadDialogState.value.errorMessage"
                class="upload-control-button"
                @click="uploadDialog.closeUploadDialog"
                :aria-label="$t('app.upload.closing')"
                :title="$t('app.upload.closing')"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <!-- 現在のファイル: エラー表示 -->
          <template v-if="uploadDialog.uploadDialogState.value.errorMessage">
            <p class="upload-error-message">
              {{ uploadDialog.uploadDialogState.value.errorMessage }}
            </p>
          </template>

          <!-- 現在のファイル: 進捗表示 -->
          <template v-else>
            <p class="upload-filename">
              {{ uploadDialog.uploadDialogState.value.fileName }}
            </p>

            <!-- プログレスバー表示 (uploading_chunk フェーズ時) -->
            <!-- UX原則: percent-done indicator は10秒以上の処理に効果的 (NN/g) -->
            <div
              v-if="uploadDialog.uploadDialogState.value.showProgressBar"
              class="upload-progress-bar-container"
            >
              <div class="upload-progress-bar-track">
                <div
                  class="upload-progress-bar-fill"
                  :class="{
                    'upload-progress-bar-fill--complete':
                      uploadDialog.uploadDialogState.value.progressPercent >=
                      100,
                  }"
                  :style="{
                    width: `${uploadDialog.uploadDialogState.value.progressPercent}%`,
                  }"
                ></div>
              </div>
              <div class="upload-progress-info">
                <span class="upload-progress-percent"
                  >{{
                    uploadDialog.uploadDialogState.value.progressPercent
                  }}%</span
                >
                <span class="upload-progress-bytes">
                  {{
                    uploadDialog.formatBytes(
                      uploadDialog.uploadDialogState.value.bytesSent,
                    )
                  }}
                  /
                  {{
                    uploadDialog.formatBytes(
                      uploadDialog.uploadDialogState.value.totalBytes,
                    )
                  }}
                </span>
              </div>
            </div>

            <!-- スピナー表示 (プログレスバーが無い時) -->
            <div v-else class="upload-progress">
              <div
                class="upload-spinner"
                v-if="uploadDialog.uploadDialogState.value.isUploading"
              ></div>
              <span
                class="upload-phase"
                :class="{
                  'upload-phase--complete':
                    uploadDialog.uploadDialogState.value.phase ===
                    'completed',
                }"
              >
                {{ uploadDialog.uploadDialogState.value.phaseText }}
              </span>
            </div>

            <!-- フェーズテキスト (プログレスバー表示時も表示) -->
            <p
              v-if="uploadDialog.uploadDialogState.value.showProgressBar"
              class="upload-phase-text"
            >
              {{ uploadDialog.uploadDialogState.value.phaseText }}
            </p>
          </template>

          <!-- キュー表示 -->
          <div
            v-if="uploadDialog.uploadQueue.items.value.length > 1"
            class="upload-queue"
          >
            <div class="upload-queue-header">
              <span class="upload-queue-title"
                >{{ $t('app.upload.waiting') }} ({{
                  uploadDialog.uploadQueue.stats.value.waiting
                }}{{ $t('app.upload.items') }})</span
              >
            </div>
            <div class="upload-queue-list">
              <div
                v-for="item in uploadDialog.uploadQueue.items.value.filter(
                  (i) => i.status === 'waiting',
                )"
                :key="item.id"
                class="upload-queue-item"
              >
                <span class="upload-queue-filename">{{
                  item.fileName
                }}</span>
                <button
                  class="upload-queue-cancel"
                  @click="uploadDialog.cancelQueueItem(item.id)"
                  :aria-label="$t('app.upload.cancel')"
                  :title="$t('app.upload.cancel')"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <path
                      d="M3 3l6 6M9 3l-6 6"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ノンモーダル アップロード進捗ダイアログ */
/* UX原則: 長時間処理はノンモーダルで、ユーザーに制御を与える (NN/g) */
.upload-dialog-nonmodal {
  position: fixed;
  right: 1.5rem;
  bottom: 1.5rem;
  z-index: 1000; /* タイトルバー(9000)より低く、他のコンテンツより高い */
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  min-width: 360px;
  max-width: 90vw;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.upload-dialog-nonmodal--minimized {
  min-width: 280px;
}

.upload-dialog-content {
  padding: 1.5rem;
}

.upload-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.upload-dialog-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.upload-dialog-controls {
  display: flex;
  gap: 0.5rem;
}

.upload-control-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.upload-control-button:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.upload-control-button:active {
  transform: scale(0.95);
}

.upload-cancel-button {
  color: var(--color-text-muted);
  transition: color 0.2s;
}

.upload-cancel-button:hover:not(:disabled) {
  color: var(--color-error, #ef4444);
}

.upload-cancel-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upload-cancel-button .spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 最小化状態のコンパクトバー */
/* UX原則: 視覚的階層でエラーを明確に伝える、認知負荷を最小限にする */
.upload-minimized-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 12px;
}

.upload-minimized-bar:hover {
  background: var(--color-surface-hover);
}

/* エラー状態: 赤系の背景で即座に認識可能（視認性） */
.upload-minimized-bar--error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--color-error, #ef4444);
}

.upload-minimized-bar--error:hover {
  background: rgba(239, 68, 68, 0.15);
}

.upload-minimized-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}

/* アイコン共通スタイル */
.upload-minimized-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

/* エラーアイコン: 赤色で警告を明確に */
.upload-minimized-icon--error {
  color: var(--color-error, #ef4444);
}

/* 成功アイコン: 緑色で達成感を演出（ピーク・エンド） */
.upload-minimized-icon--success {
  color: var(--color-success, #22c55e);
}

.upload-minimized-text {
  flex: 1;
  font-size: 0.8125rem;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* エラー時のテキストも赤色に */
.upload-minimized-bar--error .upload-minimized-text {
  color: var(--color-error, #ef4444);
  font-weight: 500;
}

.upload-minimized-percent {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-primary);
  flex-shrink: 0;
}

/* スライドインアニメーション */
.upload-slide-enter-active,
.upload-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.upload-slide-enter-from,
.upload-slide-leave-to {
  opacity: 0;
  transform: translateY(2rem);
}

.upload-error-message {
  margin: 0 0 1rem;
  padding: 0.75rem;
  font-size: 0.8125rem;
  color: var(--color-error, #ef4444);
  background: rgba(239, 68, 68, 0.1);
  border-radius: 6px;
  line-height: 1.5;
}

.upload-filename {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-bottom: 1rem;
  word-break: break-all;
}

.upload-progress {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
}

.upload-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.upload-phase {
  font-size: 0.875rem;
  color: var(--color-text);
}

.upload-phase--complete {
  color: var(--color-success, #22c55e);
  font-weight: 500;
}

/* プログレスバー
 * UX原則:
 * - 視覚的階層: バーが主役、数値は補助
 * - ドハティの閾値: スムーズなアニメーションで待ち時間を軽減
 * - ピーク・エンド: 完了時の色変化で達成感を演出
 */
.upload-progress-bar-container {
  padding: 0.5rem 0;
}

.upload-progress-bar-track {
  width: 100%;
  height: 8px;
  background: var(--color-border);
  border-radius: 4px;
  overflow: hidden;
  /* 視覚的な深み */
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.upload-progress-bar-fill {
  height: 100%;
  background: linear-gradient(
    90deg,
    var(--color-primary),
    var(--color-primary-light, #ff69b4)
  );
  border-radius: 4px;
  /* UX: 補間された進捗値のための滑らかなトランジション（100ms = 補間更新間隔） */
  /* ease-out で減速を視覚化し、chunk 境界での停止を自然に見せる */
  transition: width 0.1s linear;
  /* 輝きエフェクトで視覚的興味を維持 */
  position: relative;
  overflow: hidden;
}

.upload-progress-bar-fill::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 100px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.2) 50%,
    transparent 100%
  );
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100px);
  }
  100% {
    transform: translateX(calc(100% + 100px));
  }
}

/* 完了時の色変化 - ピーク・エンドの法則 */
.upload-progress-bar-fill--complete {
  background: linear-gradient(90deg, var(--color-success, #22c55e), #4ade80);
  transition:
    background 0.5s ease,
    width 0.3s ease-out;
}

.upload-progress-bar-fill--complete::after {
  animation: none;
}

.upload-progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
  padding: 0 0.125rem;
}

.upload-progress-percent {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  /* 数値の可読性を高める */
  font-variant-numeric: tabular-nums;
}

.upload-progress-bytes {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.upload-phase-text {
  font-size: 0.8125rem;
  color: var(--color-text);
  text-align: center;
  margin-top: 0.75rem;
  font-weight: 500;
}

/* アップロードキュー表示 */
.upload-queue {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.upload-queue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.upload-queue-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.upload-queue-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 150px;
  overflow-y: auto;
}

.upload-queue-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-surface);
  border-radius: 6px;
  transition: background 0.2s ease;
}

.upload-queue-item:hover {
  background: var(--color-border);
}

.upload-queue-filename {
  flex: 1;
  font-size: 0.8125rem;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.upload-queue-cancel {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-queue-cancel:hover {
  background: var(--color-error, #ef4444);
  color: white;
}

.upload-queue-cancel:active {
  transform: scale(0.95);
}
</style>
