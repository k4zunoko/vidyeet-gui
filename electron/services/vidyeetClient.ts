/**
 * Vidyeet Client
 *
 * Thin adapter that invokes CLI for status/login/logout/list operations
 * @see docs/CLI_CONTRACT.md
 */

import { runCli, resolveCliPath } from "./cliRunner";
import type {
  IpcError,
  StatusResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  ListResponse,
  DeleteRequest,
  DeleteResponse,
  SelectFileResponse,
  UploadRequest,
  UploadResponse,
  UploadProgress,
  AssetItem,
} from "../types/ipc";
import { isIpcError } from "../types/ipc";
import { dialog, BrowserWindow } from "electron";
import { spawn, type ChildProcess } from "child_process";
import path from "node:path";

// =============================================================================
// Upload State Management
// =============================================================================

/** Map of active uploads by uploadId */
const activeUploads = new Map<string, ChildProcess>();
let uploadIdCounter = 0;

/**
 * Generate a unique upload ID
 */
function generateUploadId(): string {
  return `upload-${Date.now()}-${++uploadIdCounter}`;
}

// =============================================================================
// CLI Response Types (internal)
// =============================================================================

/** CLI --machine status response */
interface CliStatusResponse {
  success: boolean;
  is_authenticated: boolean;
  token_id?: string;
}

/** CLI --machine login response */
interface CliLoginResponse {
  command: string;
  success: boolean;
}

/** CLI --machine logout response */
interface CliLogoutResponse {
  command: string;
  success: boolean;
}

/** CLI --machine list response */
interface CliListResponse {
  success: boolean;
  data: CliAsset[];
}

/** CLI --machine delete response */
interface CliDeleteResponse {
  command: string;
  success: boolean;
}

/** CLI asset type */
interface CliAsset {
  id: string;
  playback_ids?: Array<{ id: string; policy?: string }>;
  duration?: number;
  status?: string;
  resolution_tier?: string;
  aspect_ratio?: string;
  max_stored_frame_rate?: number;
  created_at?: string;
}

// =============================================================================
// Status
// =============================================================================

/**
 * Get authentication status
 */
export async function getStatus(): Promise<StatusResponse | IpcError> {
  const result = await runCli<CliStatusResponse>({
    args: ["status"],
  });

  if (isIpcError(result)) {
    return result;
  }

  const data = result.data;

  // Authentication check: success === true AND is_authenticated === true
  const isAuthenticated =
    data.success === true && data.is_authenticated === true;

  return {
    isAuthenticated,
  };
}

// =============================================================================
// Login
// =============================================================================

/**
 * Login (passes credentials via stdin)
 */
export async function login(
  request: LoginRequest,
): Promise<LoginResponse | IpcError> {
  // Stdin format: line 1 = Token ID / line 2 = Token Secret
  const stdin = `${request.tokenId}\n${request.tokenSecret}`;

  const result = await runCli<CliLoginResponse>({
    args: ["login", "--stdin"],
    stdin,
  });

  if (isIpcError(result)) {
    return result;
  }

  return {
    success: true,
  };
}

// =============================================================================
// Logout
// =============================================================================

/**
 * Logout
 */
export async function logout(): Promise<LogoutResponse | IpcError> {
  const result = await runCli<CliLogoutResponse>({
    args: ["logout"],
  });

  if (isIpcError(result)) {
    return result;
  }

  return {
    success: true,
  };
}

// =============================================================================
// List
// =============================================================================

/**
 * Get asset list
 */
export async function getList(): Promise<ListResponse | IpcError> {
  const result = await runCli<CliListResponse>({
    args: ["list"],
  });

  if (isIpcError(result)) {
    return result;
  }

  const data = result.data;

  // Contract violation if data.data is not an array
  if (!Array.isArray(data.data)) {
    return {
      code: "CLI_BAD_JSON",
      message: "CLI list data is not an array",
      details: { received: typeof data.data },
    };
  }

  // Convert assets
  const items: AssetItem[] = data.data.map((asset: CliAsset) => ({
    assetId: asset.id,
    // Get first playback_id, or null if none
    playbackId: asset.playback_ids?.[0]?.id ?? null,
    // Detailed information
    duration: asset.duration,
    status: asset.status,
    resolutionTier: asset.resolution_tier,
    aspectRatio: asset.aspect_ratio,
    maxFrameRate: asset.max_stored_frame_rate,
    createdAt: asset.created_at,
  }));

  return {
    items,
  };
}

// =============================================================================
// Delete
// =============================================================================

/**
 * Delete asset
 */
export async function deleteAsset(
  request: DeleteRequest,
): Promise<DeleteResponse | IpcError> {
  const result = await runCli<CliDeleteResponse>({
    args: ["delete", request.assetId, "--force"],
  });

  if (isIpcError(result)) {
    return result;
  }

  return {
    success: true,
  };
}

// =============================================================================
// File Selection
// =============================================================================

/** Video file extension filter */
const VIDEO_EXTENSIONS = [
  "mp4",
  "mov",
  "avi",
  "mkv",
  "webm",
  "wmv",
  "flv",
  "m4v",
];

/** Remember last selected directory */
let lastSelectedDirectory: string | undefined;

/**
 * Show file selection dialog
 */
export async function selectFile(): Promise<SelectFileResponse | IpcError> {
  const focusedWindow = BrowserWindow.getFocusedWindow();

  const result = await dialog.showOpenDialog(
    focusedWindow ?? (undefined as any),
    {
      title: "Select video to upload",
      defaultPath: lastSelectedDirectory,
      filters: [
        {
          name: "Video Files",
          extensions: VIDEO_EXTENSIONS,
        },
      ],
      properties: ["openFile"],
    },
  );

  if (result.canceled || result.filePaths.length === 0) {
    return { filePath: null };
  }

  const filePath = result.filePaths[0];
  // Remember selected directory
  lastSelectedDirectory = path.dirname(filePath);

  return { filePath };
}

// =============================================================================
// Upload
// =============================================================================

/**
 * Upload video
 * @param request Upload request
 * @param onProgress Progress callback
 */
export function upload(
  request: UploadRequest,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadResponse | IpcError> {
  return new Promise((resolve) => {
    const cliPath = resolveCliPath();
    const args = ["--machine", "upload", request.filePath, "--progress"];
    const uploadId = generateUploadId();

    const child = spawn(cliPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Store child process for potential cancellation
    activeUploads.set(uploadId, child);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      const text = data.toString();
      stdout += text;

      // Process JSON line by line
      const lines = text.split("\n").filter((line) => line.trim());
      for (const line of lines) {
        try {
          const json = JSON.parse(line);

          // Progress notification
          if (typeof json.phase === "string" && onProgress) {
            onProgress({
              phase: json.phase as UploadProgress["phase"],
              fileName: json.file_name,
              sizeBytes: json.size_bytes,
              format: json.format,
              uploadId,
              percent: json.percent,
              // Fields for uploading_chunk phase
              currentChunk: json.current_chunk,
              totalChunks: json.total_chunks,
              bytesSent: json.bytes_sent,
              totalBytes: json.total_bytes,
              // Fields for waiting_for_asset phase
              elapsedSecs: json.elapsed_secs,
            });
          }

          // Success completion
          if (json.success === true && json.asset_id) {
            resolve({
              success: true,
              assetId: json.asset_id,
            });
          }

          // Error completion
          if (json.success === false && json.error) {
            resolve({
              code: "CLI_NON_ZERO_EXIT",
              message: json.error.message || "Upload failed",
              details: json.error,
            });
          }
        } catch {
          // Ignore JSON parse failures (may be partial data)
        }
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("error", (err) => {
      activeUploads.delete(uploadId);
      resolve({
        code: "CLI_NOT_FOUND",
        message: `Failed to launch CLI: ${err.message}`,
      });
    });

    child.on("close", (code) => {
      activeUploads.delete(uploadId);
      // Normal exit (resolve should already be completed in stdout processing)
      if (code !== 0 && !stdout.includes('"success":true')) {
        resolve({
          code: "CLI_NON_ZERO_EXIT",
          message: `Upload failed (exit code: ${code})`,
          details: { stderr, stdout },
        });
      }
    });
  });
}

// =============================================================================
// Upload Cancellation
// =============================================================================

/**
 * Cancel an active upload by killing its CLI process
 * @param uploadId The upload ID to cancel
 * @returns true if cancelled, false if upload not found
 */
export function cancelUpload(uploadId: string): boolean {
  const child = activeUploads.get(uploadId);
  if (!child) {
    return false; // Already completed or invalid ID
  }

  child.kill(); // On Windows, this sends termination signal
  activeUploads.delete(uploadId);
  return true;
}