<template>
  <div class="about-dialog">
    <div class="about-header">
      <h1 class="app-name">Vidyeet</h1>
      <p v-if="appInfo" class="version">v{{ appInfo.version }}</p>
    </div>

    <div class="about-content">
      <p v-if="appInfo" class="description">{{ appInfo.description }}</p>

      <div v-if="appInfo" class="about-details">
        <div class="detail-item">
          <span class="label">Author:</span>
          <span class="value">{{ appInfo.author }}</span>
        </div>
        <div class="detail-item">
          <span class="label">License:</span>
          <span class="value">{{ appInfo.license }}</span>
        </div>
        <div class="detail-item">
          <span class="label">Repository:</span>
          <a :href="appInfo.repository" target="_blank" class="link">{{ appInfo.repository }}</a>
        </div>
      </div>

      <div v-if="isLoading" class="loading">
        Loading application information...
      </div>
      <div v-if="error" class="error">
        {{ error }}
      </div>
    </div>

    <div class="about-footer">
      <button @click="closeDialog" class="btn-close">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface AppInfo {
  version: string
  appName: string
  description: string
  author: string
  license: string
  repository: string
}

const appInfo = ref<AppInfo | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    // Electronの window.app API を使用（preload.ts で公開）
    if (typeof window !== 'undefined' && 'app' in window) {
      const win = window as any
      appInfo.value = await win.app.getVersion()
    } else {
      error.value = 'Application API not available'
    }
  } catch (err) {
    error.value = 'Failed to load application information'
    console.error(err)
  } finally {
    isLoading.value = false
  }
})

const closeDialog = () => {
  // Dialog close logic - parent component will handle this
  const event = new CustomEvent('close')
  window.dispatchEvent(event)
}
</script>

<style scoped>
.about-dialog {
  display: flex;
  flex-direction: column;
  padding: 24px;
  background: var(--color-background);
  color: var(--color-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 500px;
  margin: 0 auto;
}

.about-header {
  text-align: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border, #e0e0e0);
}

.app-name {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: #2c3e50;
}

.version {
  font-size: 14px;
  color: #7f8c8d;
  margin: 0;
}

.about-content {
  flex: 1;
  margin-bottom: 24px;
}

.description {
  font-size: 14px;
  line-height: 1.6;
  color: #555;
  margin: 0 0 16px 0;
}

.about-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 13px;
}

.detail-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.label {
  font-weight: 600;
  color: #2c3e50;
  min-width: 80px;
}

.value {
  color: #555;
  word-break: break-all;
}

.link {
  color: #0066cc;
  text-decoration: none;
  word-break: break-all;
}

.link:hover {
  text-decoration: underline;
}

.loading,
.error {
  padding: 12px;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
}

.loading {
  background: #e3f2fd;
  color: #1976d2;
}

.error {
  background: #ffebee;
  color: #c62828;
}

.about-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border, #e0e0e0);
}

.btn-close {
  padding: 8px 16px;
  background: #2c3e50;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-close:hover {
  background: #1a252f;
}

.btn-close:active {
  background: #0f1419;
}

/* ライトテーマ変数 */
:root {
  --color-background: white;
  --color-text: #2c3e50;
  --color-border: #e0e0e0;
}

/* ダークテーマ対応（今後） */
@media (prefers-color-scheme: dark) {
  .about-dialog {
    background: #1e1e1e;
    color: #e0e0e0;
  }

  .app-name {
    color: #e0e0e0;
  }

  .version {
    color: #a0a0a0;
  }

  .description,
  .value {
    color: #b0b0b0;
  }

  .label {
    color: #e0e0e0;
  }

  .about-details {
    background: #2a2a2a;
  }

  .link {
    color: #4da6ff;
  }
}
</style>
