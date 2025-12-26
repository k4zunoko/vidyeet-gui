<script setup lang="ts">
/**
 * サイドドロワー
 *
 * 右側からスライドインするドロワーメニュー
 * - アップロードボタン（上部）
 * - ログアウトボタン（下部）
 */

defineProps<{
  /** ドロワーの開閉状態 */
  isOpen: boolean;
}>();

const emit = defineEmits<{
  /** 閉じる要求 */
  close: [];
  /** アップロード要求 */
  upload: [];
  /** ログアウト要求 */
  logout: [];
}>();

function handleOverlayClick() {
  emit('close');
}

function handleUpload() {
  emit('upload');
}

function handleLogout() {
  emit('logout');
}
</script>

<template>
  <Teleport to="body">
    <!-- オーバーレイ -->
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="drawer-overlay"
        @click="handleOverlayClick"
      />
    </Transition>

    <!-- ドロワー本体 -->
    <Transition name="slide">
      <aside v-if="isOpen" class="drawer">
        <div class="drawer-content">
          <!-- 上部: アップロード -->
          <div class="drawer-top">
            <button class="drawer-button upload" @click="handleUpload">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2L5 7h3v6h4V7h3l-5-5zM3 16v2h14v-2H3z"/>
              </svg>
              <span>アップロード</span>
            </button>
          </div>

          <!-- 下部: ログアウト -->
          <div class="drawer-bottom">
            <button class="drawer-button logout" @click="handleLogout">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M3 3h8v2H5v10h6v2H3V3zm10 4l4 3-4 3v-2H8V9h5V7z"/>
              </svg>
              <span>ログアウト</span>
            </button>
          </div>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
}

.drawer {
  position: fixed;
  top: 32px; /* タイトルバーの高さ */
  right: 0;
  bottom: 0;
  width: 280px;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  z-index: 101;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
}

.drawer-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1rem;
}

.drawer-top {
  flex: 0 0 auto;
}

.drawer-bottom {
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.drawer-button {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.drawer-button:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-text-muted);
}

.drawer-button.upload {
  position: relative;
}

.drawer-button.upload:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.drawer-button.logout:hover {
  border-color: var(--color-error);
  color: var(--color-error);
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
