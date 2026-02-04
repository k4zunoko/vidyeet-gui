<script setup lang="ts">
/**
 * アプリ情報設定カテゴリー
 *
 * バージョン情報、アップデート、アプリ情報
 */
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import SettingSection from "../components/SettingSection.vue";
import SettingItem from "../components/SettingItem.vue";
import { isIpcError, type UpdateProgress, type UpdateStatus, type UpdateStatusPayload } from "../../../../electron/types/ipc";

const { t } = useI18n();

// アプリケーション情報
import packageJson from "../../../../package.json";

const appVersion = ref(packageJson.version);
const cliPath = ref(t("settings.appInfo.loading"));

// アップデート状態
const updateStatus = ref<UpdateStatus | "idle">("idle");
const updateInfo = ref<unknown | null>(null);
const updateProgress = ref<UpdateProgress | null>(null);
const updateErrorMessage = ref<string | null>(null);
const lastCheckedAt = ref<Date | null>(null);
const isInstalling = ref(false);

const isChecking = computed(() => updateStatus.value === "checking-for-update");
const isDownloading = computed(() => updateStatus.value === "download-progress");
const isUpdateAvailable = computed(() => updateStatus.value === "update-available");
const isUpdateDownloaded = computed(() => updateStatus.value === "update-downloaded");

const canCheckForUpdates = computed(
    () =>
        !isChecking.value &&
        !isDownloading.value &&
        !isInstalling.value &&
        updateStatus.value !== "update-downloaded"
);

const updateStatusVariant = computed(() => {
    switch (updateStatus.value) {
        case "update-not-available":
        case "update-downloaded":
            return "success";
        case "update-available":
            return "highlight";
        case "error":
            return "error";
        default:
            return "neutral";
    }
});

const updateStatusLabel = computed(() => {
    switch (updateStatus.value) {
        case "checking-for-update":
            return t("settings.update.status.checking");
        case "update-available":
            return t("settings.update.status.available");
        case "update-not-available":
            return t("settings.update.status.latest");
        case "download-progress":
            return t("settings.update.status.downloading");
        case "update-downloaded":
            return t("settings.update.status.ready");
        case "error":
            return t("settings.update.status.error");
        default:
            return t("settings.update.status.unchecked");
    }
});

const updateStatusDescription = computed(() => {
    switch (updateStatus.value) {
        case "checking-for-update":
            return t("settings.update.description.checking");
        case "update-available":
            return t("settings.update.description.available");
        case "update-not-available":
            return t("settings.update.description.latest");
        case "download-progress":
            return t("settings.update.description.downloading");
        case "update-downloaded":
            return t("settings.update.description.ready");
        case "error":
            return updateErrorMessage.value ?? t("settings.update.description.error");
        default:
            return t("settings.update.description.unchecked");
    }
});

const updateVersionLabel = computed(() => {
    if (!updateInfo.value || typeof updateInfo.value !== "object") return null;
    const data = updateInfo.value as Record<string, unknown>;
    const version =
        (typeof data.version === "string" && data.version) ||
        (typeof data.releaseName === "string" && data.releaseName) ||
        null;
    return version ? `${t("settings.update.newVersion")} ${version}` : null;
});

const downloadPercent = computed(() => {
    if (!updateProgress.value || !Number.isFinite(updateProgress.value.percent)) {
        return null;
    }
    return Math.min(100, Math.max(0, Math.round(updateProgress.value.percent)));
});

const downloadSummary = computed(() => {
    if (!updateProgress.value) return null;
    const { transferred, total, bytesPerSecond } = updateProgress.value;
    const parts: string[] = [];
    if (Number.isFinite(transferred) && Number.isFinite(total) && total > 0) {
        parts.push(`${formatBytes(transferred)} / ${formatBytes(total)}`);
    }
    if (Number.isFinite(bytesPerSecond) && bytesPerSecond > 0) {
        parts.push(`${formatBytes(bytesPerSecond)}/s`);
    }
    return parts.length > 0 ? parts.join(" · ") : null;
});

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const base = 1024;
    let value = bytes;
    let unitIndex = 0;
    while (value >= base && unitIndex < units.length - 1) {
        value /= base;
        unitIndex++;
    }
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat("ja-JP", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function setUpdateError(message: string) {
    updateStatus.value = "error";
    updateErrorMessage.value = message;
    updateProgress.value = null;
    isInstalling.value = false;
}

async function handleCheckForUpdates() {
    if (!canCheckForUpdates.value) return;
    updateStatus.value = "checking-for-update";
    updateErrorMessage.value = null;
    updateInfo.value = null;
    updateProgress.value = null;
    lastCheckedAt.value = new Date();

    const result = await window.updater.checkForUpdates();
    if (isIpcError(result)) {
        if (result.code === "AUTO_UPDATE_DISABLED") {
            setUpdateError(t("settings.update.autoUpdateError"));
            return;
        }
        setUpdateError(result.message ?? t("settings.update.errorNetwork"));
    }
}

async function handleDownloadUpdate() {
    if (!isUpdateAvailable.value || isDownloading.value) return;
    updateStatus.value = "download-progress";
    updateErrorMessage.value = null;
    updateProgress.value = null;

    const result = await window.updater.downloadUpdate();
    if (isIpcError(result)) {
        if (result.code === "AUTO_UPDATE_DISABLED") {
            setUpdateError(t("settings.update.autoUpdateError"));
            return;
        }
        setUpdateError(result.message ?? t("settings.update.errorNetwork"));
    }
}

async function handleInstallUpdate() {
    if (!isUpdateDownloaded.value || isInstalling.value) return;
    isInstalling.value = true;
    updateErrorMessage.value = null;

    const result = await window.updater.quitAndInstall();
    if (isIpcError(result)) {
        isInstalling.value = false;
        if (result.code === "AUTO_UPDATE_DISABLED") {
            setUpdateError(t("settings.update.autoUpdateError"));
            return;
        }
        setUpdateError(result.message ?? t("settings.update.errorNetwork"));
    }
}

function handleUpdateStatus(payload: UpdateStatusPayload) {
    updateStatus.value = payload.status;
    updateInfo.value = payload.info ?? updateInfo.value;
    if (payload.status === "download-progress") {
        updateProgress.value = payload.progress ?? updateProgress.value;
    } else {
        updateProgress.value = null;
    }
    if (payload.status === "error") {
        updateErrorMessage.value = payload.error ?? t("settings.update.errorNetwork");
        isInstalling.value = false;
    } else {
        updateErrorMessage.value = null;
    }
    if (
        payload.status === "update-available" ||
        payload.status === "update-not-available" ||
        payload.status === "error"
    ) {
        lastCheckedAt.value = new Date();
    }
}

let unsubscribeUpdateStatus: (() => void) | null = null;

onMounted(() => {
    cliPath.value = "bin/vidyeet-cli.exe";
    unsubscribeUpdateStatus = window.updater.onStatus(handleUpdateStatus);
});

onBeforeUnmount(() => {
    if (unsubscribeUpdateStatus) {
        unsubscribeUpdateStatus();
    }
});
</script>

<template>
    <div class="app-info-settings">
        <SettingSection
            :title="t('settings.appInfo.section.info')"
            :description="t('settings.appInfo.section.infoDesc')"
        >
            <SettingItem
                :label="t('settings.appInfo.version')"
                :description="t('settings.appInfo.versionDesc')"
            >
                <span class="info-value">v{{ appVersion }}</span>
            </SettingItem>

            <SettingItem
                :label="t('settings.appInfo.cliPath')"
                :description="t('settings.appInfo.cliPathDesc')"
            >
                <code class="code-value">{{ cliPath }}</code>
            </SettingItem>
        </SettingSection>

        <SettingSection
            :title="t('settings.update.section.update')"
            :description="t('settings.update.section.updateDesc')"
        >
            <div
                class="update-card"
                :data-variant="updateStatusVariant"
            >
                <div class="update-header">
                    <div class="update-status">
                        <span
                            class="status-badge"
                            :data-variant="updateStatusVariant"
                        >{{ updateStatusLabel }}</span>
                        <span
                            v-if="updateVersionLabel"
                            class="version-label"
                        >{{ updateVersionLabel }}</span>
                    </div>
                    <button
                        type="button"
                        class="check-button"
                        :disabled="!canCheckForUpdates"
                        @click="handleCheckForUpdates"
                    >
                        <span
                            v-if="isChecking"
                            class="spinner"
                        />
                        <span v-else>{{ t("settings.update.checkButton") }}</span>
                    </button>
                </div>

                <p class="update-description">{{ updateStatusDescription }}</p>

                <div
                    v-if="lastCheckedAt"
                    class="last-checked"
                >
                    {{ t("settings.update.lastChecked") }} {{ formatDateTime(lastCheckedAt) }}
                </div>

                <div
                    v-if="isDownloading"
                    class="download-progress"
                >
                    <div class="progress-header">
                        <span>{{ t("settings.update.progress.label") }}</span>
                        <span v-if="downloadPercent !== null">{{ downloadPercent }}%</span>
                    </div>
                    <progress
                        class="progress-bar"
                        max="100"
                        :value="downloadPercent ?? 0"
                    />
                    <div class="progress-meta">
                        <span v-if="downloadSummary">{{ downloadSummary }}</span>
                    </div>
                </div>

                <div
                    v-if="isUpdateAvailable || isUpdateDownloaded || updateStatus === 'error'"
                    class="update-actions"
                >
                    <button
                        v-if="isUpdateAvailable"
                        type="button"
                        class="action-button primary"
                        @click="handleDownloadUpdate"
                    >
                        {{ t("settings.update.downloadButton") }}
                    </button>
                    <button
                        v-else-if="isUpdateDownloaded"
                        type="button"
                        class="action-button primary"
                        @click="handleInstallUpdate"
                    >
                        <span
                            v-if="isInstalling"
                            class="spinner"
                        />
                        <span>{{ isInstalling ? t("settings.update.restarting") : t("settings.update.installButton") }}</span>
                    </button>
                    <button
                        v-else-if="updateStatus === 'error'"
                        type="button"
                        class="action-button"
                        @click="handleCheckForUpdates"
                    >
                        {{ t("settings.update.retryButton") }}
                    </button>
                </div>
            </div>
        </SettingSection>
    </div>
</template>

<style scoped>
.app-info-settings {
    display: flex;
    flex-direction: column;
    gap: 2rem;
}

.info-value {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text);
}

.code-value {
    display: inline-block;
    padding: 0.375rem 0.75rem;
    font-family: "Consolas", "Monaco", "Courier New", monospace;
    font-size: 0.8125rem;
    color: var(--color-text);
    background: var(--color-surface-dark);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.update-card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--color-surface-dark);
    border: 1px solid var(--color-border);
    border-radius: 12px;
}

.update-card[data-variant="highlight"] {
    border-color: var(--color-primary);
    background: rgba(250, 80, 181, 0.08);
}

.update-card[data-variant="success"] {
    border-color: var(--color-success);
    background: rgba(81, 207, 102, 0.12);
}

.update-card[data-variant="error"] {
    border-color: var(--color-error);
    background: var(--color-error-bg);
}

.update-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.update-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.status-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text);
    background: var(--color-border);
}

.status-badge[data-variant="highlight"] {
    color: var(--color-primary);
    background: var(--color-primary-alpha, rgba(250, 80, 181, 0.2));
}

.status-badge[data-variant="success"] {
    color: var(--color-success);
    background: rgba(81, 207, 102, 0.2);
}

.status-badge[data-variant="error"] {
    color: var(--color-error);
    background: var(--color-error-bg);
}

.version-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text);
}

.check-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text);
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.check-button:hover:not(:disabled) {
    background: var(--color-surface-hover);
    border-color: var(--color-primary-alpha, rgba(250, 80, 181, 0.3));
}

.check-button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
}

.update-description {
    margin: 0;
    font-size: 0.875rem;
    color: var(--color-text);
    line-height: 1.5;
}

.last-checked {
    font-size: 0.75rem;
    color: var(--color-text-muted);
}

.download-progress {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
}

.progress-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--color-text-muted);
}

.progress-bar {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    overflow: hidden;
    appearance: none;
}

.progress-bar::-webkit-progress-bar {
    background: var(--color-surface-dark);
    border-radius: 3px;
}

.progress-bar::-webkit-progress-value {
    background: var(--color-primary);
    border-radius: 3px;
    transition: width 0.3s ease;
}

.progress-bar::-moz-progress-bar {
    background: var(--color-primary);
    border-radius: 3px;
}

.progress-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--color-text-muted);
}

.update-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.25rem;
}

.action-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-text);
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.action-button:hover:not(:disabled) {
    background: var(--color-surface-hover);
}

.action-button.primary {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
}

.action-button.primary:hover:not(:disabled) {
    background: var(--color-primary-hover);
}

.action-button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
}

.spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: currentColor;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}
</style>
