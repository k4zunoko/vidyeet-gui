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
  | 'CLI_NOT_FOUND'
  | 'CLI_NON_ZERO_EXIT'
  | 'CLI_BAD_JSON'
  | 'CLI_TIMEOUT'
  | 'NOT_AUTHENTICATED'
  | 'UNKNOWN_ERROR';

/** IPC統一エラー応答 */
export interface IpcError {
  code: IpcErrorCode;
  message: string;
  details?: unknown;
}

/** エラー判定用ガード */
export function isIpcError(value: unknown): value is IpcError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
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
}

/** vidyeet:list 応答 */
export interface ListResponse {
  items: AssetItem[];
}

// =============================================================================
// IPC Channels
// =============================================================================

/** IPCチャネル名 */
export const IpcChannels = {
  STATUS: 'vidyeet:status',
  LOGIN: 'vidyeet:login',
  LOGOUT: 'vidyeet:logout',
  LIST: 'vidyeet:list',
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
}

/** ウィンドウ操作API */
export interface WindowApi {
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
}
