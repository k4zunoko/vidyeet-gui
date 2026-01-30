<script setup lang="ts">
/**
 * ログイン画面
 *
 * Token ID / Token Secret を入力し、CLIのログイン処理を実行
 * @see docs/UI_SPEC.md - 認証画面（Login）
 */
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { isIpcError } from '../../../electron/types/ipc';

const { t } = useI18n();

const emit = defineEmits<{
  /** ログイン成功時 */
  success: [];
}>();

// フォーム状態
const tokenId = ref('');
const tokenSecret = ref('');
const isLoading = ref(false);
const errorMessage = ref<string | null>(null);

// 入力検証
const isFormValid = computed(() => {
  return tokenId.value.trim() !== '' && tokenSecret.value.trim() !== '';
});

// ボタン無効化
const isSubmitDisabled = computed(() => {
  return !isFormValid.value || isLoading.value;
});

/**
 * ログイン実行
 */
async function handleLogin() {
  if (!isFormValid.value || isLoading.value) return;

  isLoading.value = true;
  errorMessage.value = null;

  try {
    const result = await window.vidyeet.login({
      tokenId: tokenId.value.trim(),
      tokenSecret: tokenSecret.value.trim(),
    });

    if (isIpcError(result)) {
      // エラー: 入力を保持して再試行可能に
      errorMessage.value = t('login.error');
      return;
    }

    // 成功: 親に通知
    emit('success');
  } catch (err) {
    errorMessage.value = t('login.unexpectedError');
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="login-title">{{ t('login.appTitle') }}</h1>
      <p class="login-subtitle">{{ t('login.subtitle') }}</p>

       <form class="login-form" @submit.prevent="handleLogin">
         <div class="form-group">
           <label for="token-id" class="form-label">{{ t('login.tokenId.label') }}</label>
           <input
             id="token-id"
             v-model="tokenId"
             type="text"
             class="form-input"
             :placeholder="t('login.tokenId.placeholder')"
             :disabled="isLoading"
             autocomplete="off"
           />
         </div>

         <div class="form-group">
           <label for="token-secret" class="form-label">{{ t('login.tokenSecret.label') }}</label>
           <input
             id="token-secret"
             v-model="tokenSecret"
             type="password"
             class="form-input"
             :placeholder="t('login.tokenSecret.placeholder')"
             :disabled="isLoading"
             autocomplete="off"
           />
         </div>

        <!-- エラー表示 -->
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>

         <button
           type="submit"
           class="login-button"
           :disabled="isSubmitDisabled"
         >
           <span v-if="isLoading" class="loading-text">{{ t('login.loggingIn') }}</span>
           <span v-else>{{ t('login.loginButton') }}</span>
         </button>
      </form>

       <p class="login-hint">
         {{ t('login.hint.prefix') }}
         <a href="https://dashboard.mux.com/settings/access-tokens" target="_blank" rel="noopener">
           {{ t('login.hint.link') }}
         </a>
         {{ t('login.hint.suffix') }}
       </p>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1rem;
}

.login-card {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  background: var(--color-surface);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

.login-title {
  margin: 0 0 0.25rem;
  font-size: 1.75rem;
  font-weight: 600;
  text-align: center;
  color: var(--color-text);
}

.login-subtitle {
  margin: 0 0 1.5rem;
  font-size: 0.875rem;
  text-align: center;
  color: var(--color-text-muted);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.form-input {
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-input-bg);
  color: var(--color-text);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-alpha);
}

.form-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-input::placeholder {
  color: var(--color-text-muted);
}

.error-message {
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: var(--color-error);
  background: var(--color-error-bg);
  border-radius: 8px;
}

.login-button {
  padding: 0.875rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: white;
  background: var(--color-primary);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
}

.login-button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-text {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.login-hint {
  margin: 1.5rem 0 0;
  font-size: 0.75rem;
  text-align: center;
  color: var(--color-text-muted);
}

.login-hint a {
  color: var(--color-primary);
  text-decoration: none;
}

.login-hint a:hover {
  text-decoration: underline;
}
</style>
