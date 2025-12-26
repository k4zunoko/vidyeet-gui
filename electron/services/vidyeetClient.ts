/**
 * Vidyeet Client
 *
 * CLI を呼び出して status/login/logout/list を実行する薄いアダプタ
 * @see docs/CLI_CONTRACT.md
 */

import { runCli } from './cliRunner';
import type {
  IpcError,
  StatusResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  ListResponse,
  AssetItem,
} from '../types/ipc';
import { isIpcError } from '../types/ipc';

// =============================================================================
// CLI Response Types (internal)
// =============================================================================

/** CLI --machine status の応答 */
interface CliStatusResponse {
  success: boolean;
  is_authenticated: boolean;
  token_id?: string;
}

/** CLI --machine login の応答 */
interface CliLoginResponse {
  command: string;
  success: boolean;
}

/** CLI --machine logout の応答 */
interface CliLogoutResponse {
  command: string;
  success: boolean;
}

/** CLI --machine list の応答 */
interface CliListResponse {
  success: boolean;
  data: CliAsset[];
}

/** CLI アセット型 */
interface CliAsset {
  id: string;
  playback_ids?: Array<{ id: string; policy?: string }>;
}

// =============================================================================
// Status
// =============================================================================

/**
 * 認証状態を取得
 */
export async function getStatus(): Promise<StatusResponse | IpcError> {
  const result = await runCli<CliStatusResponse>({
    args: ['status'],
  });

  if (isIpcError(result)) {
    return result;
  }

  const data = result.data;

  // 認証判定: success === true かつ is_authenticated === true
  const isAuthenticated = data.success === true && data.is_authenticated === true;

  return {
    isAuthenticated,
  };
}

// =============================================================================
// Login
// =============================================================================

/**
 * ログイン（認証情報を標準入力で渡す）
 */
export async function login(request: LoginRequest): Promise<LoginResponse | IpcError> {
  // 標準入力: 1行目 = Token ID / 2行目 = Token Secret
  const stdin = `${request.tokenId}\n${request.tokenSecret}`;

  const result = await runCli<CliLoginResponse>({
    args: ['login', '--stdin'],
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
 * ログアウト
 */
export async function logout(): Promise<LogoutResponse | IpcError> {
  const result = await runCli<CliLogoutResponse>({
    args: ['logout'],
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
 * アセット一覧を取得
 */
export async function getList(): Promise<ListResponse | IpcError> {
  const result = await runCli<CliListResponse>({
    args: ['list'],
  });

  if (isIpcError(result)) {
    return result;
  }

  const data = result.data;

  // data.data が配列でない場合は契約違反
  if (!Array.isArray(data.data)) {
    return {
      code: 'CLI_BAD_JSON',
      message: 'CLI list の data が配列ではありません',
      details: { received: typeof data.data },
    };
  }

  // アセットを変換
  const items: AssetItem[] = data.data.map((asset: CliAsset) => ({
    assetId: asset.id,
    // playback_ids の先頭の id を取得、なければ null
    playbackId: asset.playback_ids?.[0]?.id ?? null,
  }));

  return {
    items,
  };
}
