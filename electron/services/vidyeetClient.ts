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
  DeleteRequest,
  DeleteResponse,
  SelectFileResponse,
  UploadRequest,
  UploadResponse,
  UploadProgress,
  AssetItem,
} from '../types/ipc';
import { isIpcError } from '../types/ipc';
import { dialog, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import path from 'node:path';

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

/** CLI --machine delete の応答 */
interface CliDeleteResponse {
  command: string;
  success: boolean;
}

/** CLI アセット型 */
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
    // 詳細情報
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
 * アセットを削除
 */
export async function deleteAsset(request: DeleteRequest): Promise<DeleteResponse | IpcError> {
  const result = await runCli<CliDeleteResponse>({
    args: ['delete', request.assetId, '--force'],
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

/** 動画ファイル拡張子フィルタ */
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'flv', 'm4v'];

/** 前回選択したディレクトリを記憶 */
let lastSelectedDirectory: string | undefined;

/**
 * ファイル選択ダイアログを表示
 */
export async function selectFile(): Promise<SelectFileResponse | IpcError> {
  const focusedWindow = BrowserWindow.getFocusedWindow();

  const result = await dialog.showOpenDialog(focusedWindow ?? undefined as any, {
    title: 'アップロードする動画を選択',
    defaultPath: lastSelectedDirectory,
    filters: [
      {
        name: '動画ファイル',
        extensions: VIDEO_EXTENSIONS,
      },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { filePath: null };
  }

  const filePath = result.filePaths[0];
  // 選択したディレクトリを記憶
  lastSelectedDirectory = path.dirname(filePath);

  return { filePath };
}

// =============================================================================
// Upload
// =============================================================================

/**
 * CLIパスを取得（開発時はbin/、配布時はresources/bin/）
 */
function getCliPath(): string {
  const isDev = process.env.VITE_DEV_SERVER_URL !== undefined;
  if (isDev) {
    return path.join(process.env.APP_ROOT ?? '', 'bin', 'vidyeet-cli.exe');
  }
  // 配布時: resources/bin/vidyeet-cli.exe
  return path.join(process.resourcesPath, 'bin', 'vidyeet-cli.exe');
}

/**
 * 動画をアップロード
 * @param request アップロードリクエスト
 * @param onProgress 進捗コールバック
 */
export function upload(
  request: UploadRequest,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResponse | IpcError> {
  return new Promise((resolve) => {
    const cliPath = getCliPath();
    const args = ['--machine', 'upload', request.filePath, '--progress'];

    const child = spawn(cliPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout += text;

      // 改行区切りでJSONを処理
      const lines = text.split('\n').filter((line) => line.trim());
      for (const line of lines) {
        try {
          const json = JSON.parse(line);

          // 進捗通知
          if (json.phase && onProgress) {
            const p = json.phase;
            onProgress({
              phase: p.phase as UploadProgress['phase'],
              fileName: p.file_name,
              sizeBytes: p.size_bytes,
              format: p.format,
              uploadId: p.upload_id,
              percent: p.percent,
            });
          }

          // 成功完了
          if (json.success === true && json.asset_id) {
            resolve({
              success: true,
              assetId: json.asset_id,
            });
          }

          // エラー完了
          if (json.success === false && json.error) {
            resolve({
              code: 'CLI_NON_ZERO_EXIT',
              message: json.error.message || 'アップロードに失敗しました',
              details: json.error,
            });
          }
        } catch {
          // JSONパース失敗は無視（部分的なデータの可能性）
        }
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      resolve({
        code: 'CLI_NOT_FOUND',
        message: `CLIの起動に失敗しました: ${err.message}`,
      });
    });

    child.on('close', (code) => {
      // 正常終了（resolveはstdout処理で完了済みのはず）
      if (code !== 0 && !stdout.includes('"success":true')) {
        resolve({
          code: 'CLI_NON_ZERO_EXIT',
          message: `アップロードに失敗しました (exit code: ${code})`,
          details: { stderr, stdout },
        });
      }
    });
  });
}
