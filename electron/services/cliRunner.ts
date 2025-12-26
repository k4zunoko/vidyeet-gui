/**
 * CLI Runner
 *
 * vidyeet-cli.exe の実行・タイムアウト・JSON パースを担当
 * @see docs/CLI_CONTRACT.md
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { app } from 'electron';
import type { IpcError, IpcErrorCode } from '../types/ipc';

// =============================================================================
// Configuration
// =============================================================================

/** CLIタイムアウト（ミリ秒） */
const CLI_TIMEOUT_MS = 30_000;

/** CLI実行可能ファイル名 */
const CLI_EXECUTABLE = 'vidyeet-cli.exe';

// =============================================================================
// CLI Path Resolution
// =============================================================================

/**
 * CLIのパスを解決
 * - 開発時: リポジトリの bin/vidyeet-cli.exe
 * - 配布時: app.getAppPath() 基準の bin/vidyeet-cli.exe
 */
export function resolveCliPath(): string {
  const isDev = !app.isPackaged;

  if (isDev) {
    // 開発時: プロジェクトルートの bin/
    return path.join(process.cwd(), 'bin', CLI_EXECUTABLE);
  } else {
    // 配布時: アプリケーション内の bin/
    // electron-builder で extraResources に含める想定
    return path.join(process.resourcesPath, 'bin', CLI_EXECUTABLE);
  }
}

// =============================================================================
// CLI Runner
// =============================================================================

export interface CliRunOptions {
  /** CLI引数 */
  args: string[];
  /** 標準入力に渡すデータ */
  stdin?: string;
  /** タイムアウト（ミリ秒） */
  timeout?: number;
}

export interface CliRunResult<T = unknown> {
  success: true;
  data: T;
}

/**
 * CLI を実行し、JSON結果を返す
 *
 * - `--machine` フラグは自動付与
 * - stdout を JSON としてパース
 * - タイムアウト、非0終了、JSONパース失敗を統一エラーに変換
 */
export async function runCli<T = unknown>(
  options: CliRunOptions
): Promise<CliRunResult<T> | IpcError> {
  const cliPath = resolveCliPath();
  const timeout = options.timeout ?? CLI_TIMEOUT_MS;

  // --machine フラグを先頭に付与
  const args = ['--machine', ...options.args];

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    // タイムアウトタイマー
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      resolve(createError('CLI_TIMEOUT', `CLI がタイムアウトしました（${timeout}ms）`));
    }, timeout);

    const child = spawn(cliPath, args, {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // エラーイベント（CLI が見つからない場合など）
    child.on('error', (err) => {
      clearTimeout(timer);
      if (err.message.includes('ENOENT')) {
        resolve(createError('CLI_NOT_FOUND', `CLI が見つかりません: ${cliPath}`));
      } else {
        resolve(createError('UNKNOWN_ERROR', `CLI 起動エラー: ${err.message}`));
      }
    });

    // stdout/stderr 収集
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // 標準入力にデータを流す
    if (options.stdin) {
      child.stdin.write(options.stdin);
      child.stdin.end();
    } else {
      child.stdin.end();
    }

    // 終了処理
    child.on('close', (code) => {
      clearTimeout(timer);

      if (killed) {
        return; // タイムアウトで既に resolve 済み
      }

      // JSON パース
      let parsed: unknown;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        // 開発時デバッグ用ログ（UIには渡さない）
        logDebug('CLI_BAD_JSON', { stdout, stderr, exitCode: code });
        resolve(
          createError(
            'CLI_BAD_JSON',
            'CLI 出力が JSON として解釈できません',
            { exitCode: code }
          )
        );
        return;
      }

      // CLI レベルの success チェック
      if (typeof parsed === 'object' && parsed !== null) {
        const obj = parsed as Record<string, unknown>;

        // CLI が success: false を返した場合
        if (obj['success'] === false) {
          const errorInfo = obj['error'] as Record<string, unknown> | undefined;
          // hint は安全な情報として扱う（CLI契約で保証）
          const hint = errorInfo?.['hint']?.toString();
          resolve(
            createError(
              'CLI_NON_ZERO_EXIT',
              errorInfo?.['message']?.toString() ?? 'CLI がエラーを返しました',
              { exitCode: code, hint }
            )
          );
          return;
        }
      }

      // exit code 非0（success: false 以外のケース）
      if (code !== 0) {
        // 開発時デバッグ用ログ（UIには渡さない）
        logDebug('CLI_NON_ZERO_EXIT', { stdout, stderr, exitCode: code });
        resolve(
          createError(
            'CLI_NON_ZERO_EXIT',
            `CLI が非0終了しました（code: ${code}）`,
            { exitCode: code }
          )
        );
        return;
      }

      // 成功
      resolve({
        success: true,
        data: parsed as T,
      });
    });
  });
}

// =============================================================================
// Error Helpers
// =============================================================================

function createError(
  code: IpcErrorCode,
  message: string,
  details?: unknown
): IpcError {
  return { code, message, details };
}

/**
 * 開発時のみデバッグログを出力
 * 本番ビルドでは出力されない（将来的にファイルログへ移行可能）
 *
 * @see docs/ERROR_HANDLING.md - ログ方針
 */
function logDebug(context: string, data: { stdout?: string; stderr?: string; exitCode?: number | null }): void {
  if (app.isPackaged) {
    return; // 本番では出力しない
  }
  console.error(`[cliRunner:${context}]`, {
    exitCode: data.exitCode,
    stderr: data.stderr?.slice(0, 500), // 長すぎる場合は切り詰め
    stdout: data.stdout?.slice(0, 500),
  });
}
