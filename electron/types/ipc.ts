/**
 * IPC Contract Types
 *
 * Renderer（Vue）から Main（Electron）へ要求する操作の型定義
 * @see docs/IPC_CONTRACT.md
 */

// =============================================================================
// Error Types
// =============================================================================

/** IPC統一エラーコード */
export type IpcErrorCode =
  | "CLI_NOT_FOUND"
  | "CLI_NON_ZERO_EXIT"
  | "CLI_BAD_JSON"
  | "CLI_TIMEOUT"
  | "NOT_AUTHENTICATED"
  | "UNKNOWN_ERROR";

/** IPC統一エラー応答 */
export interface IpcError {
  code: IpcErrorCode;
  message: string;
  details?: unknown;
}

/** エラー判定用ガード */
export function isIpcError(value: unknown): value is IpcError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "message" in value
  );
}

// =============================================================================
// Request/Response Types
// =============================================================================

/** vidyeet:status 応答 */
export interface StatusResponse {
  isAuthenticated: boolean;
}

/** vidyeet:login 要求 */
export interface LoginRequest {
  tokenId: string;
  tokenSecret: string;
}

/** vidyeet:login 応答 */
export interface LoginResponse {
  success: true;
}

/** vidyeet:logout 応答 */
export interface LogoutResponse {
  success: true;
}

/** アセットアイテム */
export interface AssetItem {
  assetId: string;
  playbackId: string | null;
  /** 動画の長さ（秒） */
  duration?: number;
  /** 動画ステータス */
  status?: string;
  /** 解像度 (例: "1080p") */
  resolutionTier?: string;
  /** アスペクト比 (例: "16:9") */
  aspectRatio?: string;
  /** 最大フレームレート */
  maxFrameRate?: number;
  /** 作成日時 (Unix timestamp文字列) */
  createdAt?: string;
}

/** vidyeet:list 応答 */
export interface ListResponse {
  items: AssetItem[];
}

/** vidyeet:delete 要求 */
export interface DeleteRequest {
  assetId: string;
}

/** vidyeet:delete 応答 */
export interface DeleteResponse {
  success: true;
}

/** vidyeet:selectFile 応答 */
export interface SelectFileResponse {
  /** ユーザーがキャンセルした場合は null */
  filePath: string | null;
}

/** アップロード進捗フェーズ */
export type UploadPhase =
  | "validating_file"
  | "file_validated"
  | "creating_direct_upload"
  | "direct_upload_created"
  | "uploading_file"
  | "uploading_chunk"
  | "file_uploaded"
  | "waiting_for_asset"
  | "completed";

/** アップロード進捗情報 */
export interface UploadProgress {
  phase: UploadPhase;
  fileName?: string;
  sizeBytes?: number;
  format?: string;
  uploadId?: string;
  percent?: number;
  /** チャンクアップロード進捗 (uploading_chunk フェーズ) */
  currentChunk?: number;
  /** 総チャンク数 (uploading_file, uploading_chunk フェーズ) */
  totalChunks?: number;
  bytesSent?: number;
  totalBytes?: number;
  /** アセット待機中の経過時間 (waiting_for_asset フェーズ) */
  elapsedSecs?: number;
}

/** vidyeet:upload 要求 */
export interface UploadRequest {
  filePath: string;
}

/** vidyeet:upload 応答 */
export interface UploadResponse {
  success: true;
  assetId: string;
}

// =============================================================================
// IPC Channels
// =============================================================================

/** IPCチャネル名 */
export const IpcChannels = {
  STATUS: "vidyeet:status",
  LOGIN: "vidyeet:login",
  LOGOUT: "vidyeet:logout",
  LIST: "vidyeet:list",
  DELETE: "vidyeet:delete",
  SELECT_FILE: "vidyeet:selectFile",
  UPLOAD: "vidyeet:upload",
  CLIPBOARD_WRITE: "clipboard:write",
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

// =============================================================================
// Window.vidyeet API Types (for Renderer)
// =============================================================================

/** Renderer側で使用する高水準API */
export interface VidyeetApi {
  status(): Promise<StatusResponse | IpcError>;
  login(request: LoginRequest): Promise<LoginResponse | IpcError>;
  logout(): Promise<LogoutResponse | IpcError>;
  list(): Promise<ListResponse | IpcError>;
  delete(request: DeleteRequest): Promise<DeleteResponse | IpcError>;
  selectFile(): Promise<SelectFileResponse | IpcError>;
  upload(
    request: UploadRequest,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<UploadResponse | IpcError>;
}

/** クリップボードAPI */
export interface ClipboardApi {
  writeText(text: string): Promise<void>;
}

/** ウィンドウ操作API */
export interface WindowApi {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
}

/** アプリケーション情報 */
export interface AppInfo {
  version: string;
  appName: string;
  description: string;
  author: string;
  license: string;
  repository: string;
}

/** アプリケーション情報API */
export interface AppApi {
  getVersion(): Promise<AppInfo>;
}
