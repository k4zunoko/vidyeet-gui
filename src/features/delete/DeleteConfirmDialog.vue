<script setup lang="ts">
/**
 * 削除確認ダイアログコンポーネント
 *
 * 動画削除の確認ダイアログを表示するコンポーネント。
 * useDeleteDialog composable を内部で使用し、削除処理を管理する。
 */
import { watch } from "vue";
import { useI18n } from "vue-i18n";
import { isIpcError } from "../../../electron/types/ipc";
import { useDeleteDialog } from "../../composables/useDeleteDialog";
import { useToast } from "../../composables/useToast";
import type { VideoItem } from "../../types/app";

const props = defineProps<{
  /** ダイアログの表示状態（v-model） */
  modelValue: boolean;
  /** 削除対象の動画 */
  video: VideoItem | null;
}>();

const emit = defineEmits<{
  /** ダイアログの表示状態を更新（v-model） */
  "update:modelValue": [value: boolean];
  /** 削除成功時に動画IDを通知 */
  deleted: [videoId: string];
}>();

const { t } = useI18n();
const { showToast } = useToast();

const deleteDialog = useDeleteDialog({
  onDelete: async (assetId: string) => {
    const result = await window.vidyeet.delete({ assetId });
    if (isIpcError(result)) {
      throw new Error(t("app.deleteDialog.error"));
    }
  },
  onDeleted: (assetId: string) => {
    emit("deleted", assetId);
  },
  showToast,
});

// modelValue が true になったとき、かつ video が渡されたらダイアログを開く
watch(
  () => [props.modelValue, props.video] as [boolean, VideoItem | null],
  ([isOpen, video]) => {
    if (isOpen && video && !deleteDialog.state.value.isOpen) {
      deleteDialog.openDeleteDialog(video);
    }
  }
);

// ダイアログが内部で閉じられたとき、親に通知
watch(
  () => deleteDialog.state.value.isOpen,
  (isOpen) => {
    if (!isOpen && props.modelValue) {
      emit("update:modelValue", false);
    }
  }
);

function handleCancel(): void {
  deleteDialog.cancelDelete();
  emit("update:modelValue", false);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div
        v-if="deleteDialog.state.value.isOpen"
        class="dialog-overlay"
        @click.self="handleCancel"
      >
        <div
          class="delete-dialog"
          role="alertdialog"
          aria-labelledby="delete-dialog-title"
        >
          <h2 id="delete-dialog-title" class="dialog-title">
            {{ $t('app.deleteDialog.title') }}
          </h2>
          <p class="dialog-message">
            {{ $t('app.deleteDialog.message') }}
          </p>
          <p
            v-if="deleteDialog.state.value.errorMessage"
            class="dialog-error"
          >
            {{ deleteDialog.state.value.errorMessage }}
          </p>
          <div class="dialog-actions">
            <button
              class="dialog-button dialog-button--cancel"
              :disabled="deleteDialog.state.value.isDeleting"
              @click="handleCancel"
            >
              {{ $t('app.deleteDialog.cancelButton') }}
            </button>
            <button
              class="dialog-button dialog-button--danger"
              :disabled="deleteDialog.state.value.isDeleting"
              @click="deleteDialog.confirmDelete"
            >
              {{
                deleteDialog.state.value.isDeleting
                  ? $t('app.deleteDialog.deleting')
                  : $t('app.deleteDialog.deleteButton')
              }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* モーダルダイアログ（削除確認など）用のオーバーレイ */
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.15s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-active .delete-dialog,
.dialog-leave-active .delete-dialog {
  transition:
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.15s ease;
}

.dialog-enter-from .delete-dialog,
.dialog-leave-to .delete-dialog {
  opacity: 0;
  transform: scale(0.95) translateY(-8px);
}

.delete-dialog {
  width: 90%;
  max-width: 360px;
  padding: 1.5rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);
}

.dialog-title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.dialog-message {
  margin: 0 0 1.25rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.dialog-error {
  margin: 0 0 1rem;
  font-size: 0.8125rem;
  color: var(--color-error, #ef4444);
}

.dialog-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.dialog-button {
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background 0.15s ease,
    opacity 0.15s ease;
  /* Fitts' Law: 十分なタッチターゲット */
  min-height: 36px;
  min-width: 80px;
}

.dialog-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dialog-button--cancel {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

.dialog-button--cancel:hover:not(:disabled) {
  background: var(--color-surface-dark);
}

.dialog-button--danger {
  color: white;
  background: var(--color-error, #ef4444);
}

.dialog-button--danger:hover:not(:disabled) {
  background: #dc2626;
}
</style>
