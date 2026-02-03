<script setup lang="ts">
/**
 * 動画コンテキストメニュー
 *
 * 動画に対する右クリックメニューをグローバルに管理
 * - リンクをコピー（MP4 URL）
 * - 削除
 *
 * 人間工学的UI/UX設計:
 * - Fitts' Law: 十分なタッチターゲット（36px以上）
 * - 視覚的フィードバック: ホバー時の背景変化、危険な操作は赤色
 * - アニメーション: 0.15秒のイージングで表示
 * - Escキー/外部クリックで閉じる
 */
import { ref, onUnmounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { VideoItem } from '../types/app';
import { getMp4Url, getHlsUrl, getThumbnailUrl, getAnimatedGifUrl } from '../utils/muxUrls';
import { useCopyTemplates } from '../composables/useCopyTemplates';
import { useToast } from '../composables/useToast';
import { isIpcError } from '../../electron/types/ipc';

const props = defineProps<{
  /** メニューを表示するか */
  isOpen: boolean;
  /** 対象の動画 */
  video: VideoItem | null;
  /** 表示位置 X */
  x: number;
  /** 表示位置 Y */
  y: number;
}>();

const emit = defineEmits<{
  /** メニューを閉じる */
  close: [];
  /** 削除を要求 */
  delete: [video: VideoItem];
  /** コピー成功 */
  copySuccess: [];
}>();

const { t } = useI18n();
const { templates, loadTemplates, applyTemplate } = useCopyTemplates();
const { showToast } = useToast();

/**
 * 秒数を HH:MM:SS 形式にフォーマット
 */
function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// コンテキストメニューの参照
const menuRef = ref<HTMLElement | null>(null);

/**
 * MP4リンクをクリップボードにコピー
 */
async function handleCopyLink() {
  if (!props.video?.playbackId) return;

  const mp4Url = getMp4Url(props.video.playbackId);
  await window.clipboard.writeText(mp4Url);
  showToast('success', t('app.toasts.linkCopied'));
  emit('copySuccess');
  emit('close');
}

/**
 * テンプレートを使用してコピー
 */
async function handleTemplateCopy(templateId: string, templateName: string) {
  if (!props.video) return;

  try {
    // 変数を構築
    const video = props.video;
    const playbackId = video.playbackId;
    
    const variables: Record<string, string | number | null> = {
      ASSET_ID: video.assetId,
      PLAYBACK_ID: playbackId,
      DURATION: video.duration ?? null,
      DURATION_FORMATTED: video.duration ? formatDuration(video.duration) : null,
      STATUS: video.status ?? null,
      RESOLUTION: video.resolutionTier ?? null,
      ASPECT_RATIO: video.aspectRatio ?? null,
      FRAME_RATE: video.maxFrameRate ?? null,
      CREATED_AT: video.createdAt ?? null,
      HLS_URL: playbackId ? getHlsUrl(playbackId) : null,
      MP4_URL: playbackId ? getMp4Url(playbackId) : null,
      THUMBNAIL_URL: playbackId ? getThumbnailUrl(playbackId) : null,
      GIF_URL: playbackId ? getAnimatedGifUrl(playbackId) : null,
    };

    const result = await applyTemplate(templateId, variables);
    
    if (isIpcError(result)) {
      throw new Error(result.message);
    }

    await window.clipboard.writeText(result);
    showToast('success', t('copyTemplate.toast.copySuccess', { name: templateName }));
    emit('copySuccess');
    emit('close');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    showToast('error', t('copyTemplate.toast.copyError', { reason: message }));
    emit('close');
  }
}

/**
 * テンプレート一覧を読み込み
 */
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    loadTemplates();
  }
});

/**
 * 動画を削除
 */
function handleDelete() {
  if (!props.video) return;
  emit('close');
  emit('delete', props.video);
}

/**
 * メニュー外クリックで閉じる
 */
function handleOutsideClick(event: MouseEvent) {
  if (props.isOpen && menuRef.value && !menuRef.value.contains(event.target as Node)) {
    emit('close');
  }
}

/**
 * Escキーでメニューを閉じる
 */
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.isOpen) {
    emit('close');
  }
}

// メニュー表示時にイベントリスナーを登録
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      // 次のティックで登録（現在のクリックイベントを無視するため）
      setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
        document.addEventListener('keydown', handleKeyDown);
      }, 0);
    } else {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    }
  }
);

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick);
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="context-menu">
      <div
        v-if="isOpen && video"
        ref="menuRef"
        class="context-menu"
        :style="{ left: `${x}px`, top: `${y}px` }"
        role="menu"
        :aria-label="t('contextMenu.ariaLabel')"
      >
        <!-- テンプレートコピー -->
        <div v-if="templates.length > 0" class="context-menu-section">
          <div class="context-menu-section-title">{{ t('contextMenu.copyTemplates') }}</div>
          <button
            v-for="template in templates"
            :key="template.id"
            class="context-menu-item context-menu-item--template"
            role="menuitem"
            @click="handleTemplateCopy(template.id, template.name)"
          >
            <svg class="menu-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            <span>{{ template.name }}</span>
          </button>
        </div>
        <div v-if="templates.length > 0" class="context-menu-divider"></div>

        <!-- 通常のコピー -->
        <button
          class="context-menu-item"
          role="menuitem"
          @click="handleCopyLink"
        >
          <svg class="menu-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
          <span>{{ t('contextMenu.copyLink') }}</span>
        </button>
        <div class="context-menu-divider"></div>
        <button
          class="context-menu-item context-menu-item--danger"
          role="menuitem"
          @click="handleDelete"
        >
          <svg class="menu-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
          <span>{{ t('contextMenu.delete') }}</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  z-index: 9999;
  min-width: 160px;
  padding: 4px 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(8px);
}

.context-menu-enter-active {
  animation: contextMenuIn 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.context-menu-leave-active {
  animation: contextMenuIn 0.1s cubic-bezier(0.4, 0, 0.2, 1) reverse;
}

@keyframes contextMenuIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  font-size: 0.8125rem;
  color: var(--color-text);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease;
  /* Fitts' Law: 十分なタッチターゲット */
  min-height: 36px;
}

.context-menu-item:hover {
  background: var(--color-surface-hover);
}

.context-menu-item:focus {
  outline: none;
  background: var(--color-surface-hover);
}

.context-menu-item--danger {
  color: var(--color-error, #ef4444);
}

.context-menu-item--danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.menu-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  opacity: 0.8;
}

.context-menu-divider {
  height: 1px;
  margin: 4px 8px;
  background: var(--color-border);
}

.context-menu-section {
  padding: 4px 0;
}

.context-menu-section-title {
  padding: 4px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.context-menu-item--template {
  padding-left: 32px;
}
</style>
