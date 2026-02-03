<script setup lang="ts">
/**
 * コピーテンプレート設定コンポーネント
 *
 * カスタムURLテンプレートの作成・編集・削除を管理
 */
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useCopyTemplates } from '../composables/useCopyTemplates';
import { useToast } from '../composables/useToast';
import type { CopyTemplate } from '../../electron/types/ipc';

const { t } = useI18n();
const { templates, isLoading, loadTemplates, addTemplate, updateTemplate, deleteTemplate } = useCopyTemplates();
const { showToast } = useToast();

// 新規テンプレートフォーム
const newName = ref('');
const newContent = ref('');
const formError = ref('');

// 編集モード
const editingId = ref<string | null>(null);
const editName = ref('');
const editContent = ref('');

// 削除確認
const deletingId = ref<string | null>(null);

// 利用可能な変数一覧
const availableVariables = [
  '${ASSET_ID}',
  '${PLAYBACK_ID}',
  '${DURATION}',
  '${DURATION_FORMATTED}',
  '${STATUS}',
  '${RESOLUTION}',
  '${ASPECT_RATIO}',
  '${FRAME_RATE}',
  '${CREATED_AT}'
];

// フォーム検証
const isFormValid = computed(() => {
  return newName.value.trim().length > 0 && newContent.value.trim().length > 0;
});

const isEditFormValid = computed(() => {
  return editName.value.trim().length > 0 && editContent.value.trim().length > 0;
});

// 重複チェック
function isDuplicateName(name: string, excludeId?: string): boolean {
  return templates.value.some(
    t => t.name.toLowerCase() === name.toLowerCase() && t.id !== excludeId
  );
}

// 新規テンプレート追加
async function handleAdd() {
  if (!isFormValid.value) {
    formError.value = t('copyTemplate.errors.emptyName');
    return;
  }

  if (isDuplicateName(newName.value)) {
    formError.value = t('copyTemplate.errors.duplicateName');
    return;
  }

  try {
    await addTemplate({
      name: newName.value.trim(),
      content: newContent.value.trim()
    });
    
    newName.value = '';
    newContent.value = '';
    formError.value = '';
    
    showToast('success', t('copyTemplate.toast.saveSuccess'));
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Error';
    showToast('error', t('copyTemplate.toast.saveError'));
  }
}

// 編集開始
function startEdit(template: CopyTemplate) {
  editingId.value = template.id;
  editName.value = template.name;
  editContent.value = template.content;
}

// 編集キャンセル
function cancelEdit() {
  editingId.value = null;
  editName.value = '';
  editContent.value = '';
}

// 編集保存
async function handleSaveEdit() {
  if (!editingId.value || !isEditFormValid.value) return;

  if (isDuplicateName(editName.value, editingId.value)) {
    formError.value = t('copyTemplate.errors.duplicateName');
    return;
  }

  try {
    await updateTemplate(editingId.value, {
      name: editName.value.trim(),
      content: editContent.value.trim()
    });
    
    editingId.value = null;
    formError.value = '';
    
    showToast('success', t('copyTemplate.toast.saveSuccess'));
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Error';
    showToast('error', t('copyTemplate.toast.saveError'));
  }
}

// 削除確認開始
function startDelete(id: string) {
  deletingId.value = id;
}

// 削除キャンセル
function cancelDelete() {
  deletingId.value = null;
}

// 削除実行
async function handleConfirmDelete() {
  if (!deletingId.value) return;

  try {
    await deleteTemplate(deletingId.value);
    deletingId.value = null;
    showToast('success', t('copyTemplate.toast.deleteSuccess'));
  } catch (err) {
    showToast('error', t('copyTemplate.toast.deleteError'));
  }
}

// 初期読み込み
onMounted(() => {
  loadTemplates();
});
</script>

<template>
  <div class="copy-template-settings">
    <!-- テンプレート一覧 -->
    <div class="template-list">
      <div
        v-for="template in templates"
        :key="template.id"
        class="template-item"
      >
        <div v-if="editingId === template.id" class="template-edit-form">
          <input
            v-model="editName"
            type="text"
            class="form-input"
            :placeholder="t('copyTemplate.nameLabel')"
          />
          <textarea
            v-model="editContent"
            class="form-input"
            :placeholder="t('copyTemplate.contentLabel')"
            rows="2"
          />
          <div class="template-actions">
            <button
              class="settings-action-button"
              @click="handleSaveEdit"
              :disabled="!isEditFormValid"
            >
              {{ t('copyTemplate.saveButton') }}
            </button>
            <button
              class="settings-action-button settings-action-button--ghost"
              @click="cancelEdit"
            >
              {{ t('copyTemplate.cancelButton') }}
            </button>
          </div>
        </div>
        <div v-else-if="deletingId === template.id" class="template-delete-confirm">
          <span class="delete-confirm-text">{{ template.name }} - {{ t('copyTemplate.deleteConfirm') }}</span>
          <div class="template-actions">
            <button
              class="settings-action-button settings-action-button--danger"
              @click="handleConfirmDelete"
            >
              {{ t('copyTemplate.deleteButton') }}
            </button>
            <button
              class="settings-action-button settings-action-button--ghost"
              @click="cancelDelete"
            >
              {{ t('copyTemplate.cancelButton') }}
            </button>
          </div>
        </div>
        <div v-else class="template-row">
          <span class="template-name">{{ template.name }}</span>
          <div class="template-actions">
            <button
              class="template-action-btn"
              @click="startEdit(template)"
              :title="t('copyTemplate.editButton')"
            >
              {{ t('copyTemplate.editButton') }}
            </button>
            <button
              class="template-action-btn template-action-btn--danger"
              @click="startDelete(template.id)"
              :title="t('copyTemplate.deleteButton')"
            >
              {{ t('copyTemplate.deleteButton') }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="templates.length === 0 && !isLoading" class="template-empty">
        {{ t('copyTemplate.empty') }}
      </div>
    </div>

    <!-- 新規追加フォーム -->
    <div class="template-add-section">
      <h4 class="template-subtitle">{{ t('copyTemplate.addTitle') }}</h4>
      
      <div class="template-form">
        <div class="form-group">
          <label class="form-label">{{ t('copyTemplate.nameLabel') }}</label>
          <input
            v-model="newName"
            type="text"
            class="form-input"
            :placeholder="t('copyTemplate.namePlaceholder')"
          />
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('copyTemplate.contentLabel') }}</label>
          <textarea
            v-model="newContent"
            class="form-input"
            :placeholder="t('copyTemplate.contentPlaceholder')"
            rows="3"
          />
        </div>

        <div class="variables-help">
          <span class="variables-label">{{ t('copyTemplate.variablesHelp') }}:</span>
          <code class="variables-list">{{ availableVariables.join(', ') }}</code>
        </div>

        <div v-if="formError" class="form-error">
          {{ formError }}
        </div>

        <button
          class="settings-action-button settings-action-button--primary"
          @click="handleAdd"
          :disabled="!isFormValid || isLoading"
        >
          {{ isLoading ? t('copyTemplate.adding') : t('copyTemplate.addButton') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.copy-template-settings {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.template-item {
  background: var(--color-surface-dark);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.75rem;
}

.template-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.template-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.template-actions {
  display: flex;
  gap: 0.5rem;
}

.template-action-btn {
  padding: 0.4rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.template-action-btn:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-primary-alpha);
}

.template-action-btn--danger {
  color: var(--color-error);
  border-color: var(--color-error);
}

.template-action-btn--danger:hover {
  background: var(--color-error-bg);
}

.template-edit-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.template-edit-form input,
.template-edit-form textarea {
  width: 100%;
}

.template-delete-confirm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.delete-confirm-text {
  font-size: 0.875rem;
  color: var(--color-text);
}

.template-empty {
  padding: 1rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  background: var(--color-surface-dark);
  border: 1px dashed var(--color-border);
  border-radius: 8px;
}

.template-add-section {
  border-top: 1px solid var(--color-border);
  padding-top: 1rem;
}

.template-subtitle {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
}

.template-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.form-input {
  padding: 0.6rem 0.75rem;
  font-size: 0.875rem;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  transition: border-color 0.15s ease;
  font-family: inherit;
  resize: vertical;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.6;
}

.variables-help {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem;
  background: var(--color-surface);
  border-radius: 6px;
  font-size: 0.75rem;
}

.variables-label {
  font-weight: 500;
  color: var(--color-text-muted);
}

.variables-list {
  color: var(--color-text);
  font-family: 'Consolas', 'Monaco', monospace;
  word-break: break-word;
}

.form-error {
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--color-error);
  background: var(--color-error-bg);
  border: 1px solid var(--color-error);
  border-radius: 6px;
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
  transition: all 0.2s ease;
  min-height: 40px;
}

.settings-action-button:hover:not(:disabled) {
  background: var(--color-surface-hover);
  border-color: var(--color-primary-alpha);
}

.settings-action-button--primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.settings-action-button--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.settings-action-button--danger {
  color: var(--color-error);
  border-color: var(--color-error);
}

.settings-action-button--danger:hover:not(:disabled) {
  background: var(--color-error-bg);
}

.settings-action-button--ghost:hover:not(:disabled) {
  background: var(--color-surface-hover);
}

.settings-action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>