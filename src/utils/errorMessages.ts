/**
 * エラーメッセージの一元管理
 *
 * @see docs/ERROR_HANDLING.md
 */

export const ERROR_MESSAGES = {
  /** 認証関連 */
  AUTH: {
    INVALID_CREDENTIALS: 'Token IDまたはToken Secretが正しくありません。',
    AUTH_REQUIRED: '認証情報の更新が必要です。',
    SESSION_EXPIRED: 'セッションの有効期限が切れました。再度ログインしてください。',
    LOGIN_FAILED: 'ログインに失敗しました。認証情報を確認して再試行してください。',
    LOGOUT_FAILED: 'ログアウトに失敗しました。再試行してください。',
  },

  /** アップロード関連 */
  UPLOAD: {
    INVALID_FILE_TYPE: '動画ファイルのみアップロードできます（MP4, MOV, MKVなど）',
    FILE_TOO_LARGE: 'ファイルサイズが大きすぎます。最大5GBまでです。',
    NETWORK_ERROR: 'ネットワーク接続を確認してください。',
    UPLOAD_CANCELLED: 'アップロードがキャンセルされました。',
    UPLOAD_FAILED: 'アップロードに失敗しました。もう一度お試しください。',
    CLI_ERROR: 'アップロード処理でエラーが発生しました。',
  },

  /** 削除関連 */
  DELETE: {
    DELETE_FAILED: '動画の削除に失敗しました。もう一度お試しください。',
    DELETE_CONFIRM: 'この操作は取り消せません。Muxから完全に削除されます。',
    NOT_FOUND: '削除対象の動画が見つかりません。',
  },

  /** 一覧取得関連 */
  LIST: {
    FETCH_FAILED: '動画一覧の取得に失敗しました。再試行してください。',
    EMPTY_LIST: 'アップロード済みの動画がありません。',
  },

  /** ファイル選択関連 */
  FILE: {
    SELECTION_CANCELLED: 'ファイルが選択されませんでした。',
    READ_FAILED: 'ファイルの読み込みに失敗しました。',
    PATH_INVALID: 'ファイルパスが無効です。',
  },

  /** 共通/汎用エラー */
  GENERIC: {
    INIT_FAILED: '初期化に失敗しました。アプリを再起動してください。',
    UNEXPECTED: '予期しないエラーが発生しました。',
    TIMEOUT: 'タイムアウト: 処理に時間がかかっています。再試行してください。',
    NETWORK_UNAVAILABLE: 'ネットワークが利用できません。インターネット接続を確認してください。',
    PERMISSION_DENIED: 'この操作に必要な権限がありません。',
  },

  /** CLI関連 */
  CLI: {
    NOT_FOUND: 'CLI実行ファイルが見つかりません。アプリを再インストールしてください。',
    EXECUTION_FAILED: 'CLI実行に失敗しました。',
    OUTPUT_PARSE_ERROR: 'CLI出力の解析に失敗しました。',
  },
} as const

/**
 * エラーメッセージを取得（キー存在チェック付き）
 * @param category - エラーカテゴリ
 * @param key - エラーメッセージキー
 * @param fallback - フォールバックメッセージ
 */
export function getErrorMessage(
  category: keyof typeof ERROR_MESSAGES,
  key: string,
  fallback = '予期しないエラーが発生しました。'
): string {
  const categoryMessages = ERROR_MESSAGES[category]
  if (!categoryMessages) return fallback

  const message = (categoryMessages as Record<string, string>)[key]
  return message ?? fallback
}

/**
 * CLIエラーコードをユーザー向けメッセージに変換
 * @param code - CLIエラーコード
 * @param details - エラー詳細
 */
export function mapCliErrorToMessage(code: string, details?: string): string {
  switch (code) {
    case 'CLI_NOT_FOUND':
      return ERROR_MESSAGES.CLI.NOT_FOUND
    case 'CLI_NON_ZERO_EXIT':
      return details ?? ERROR_MESSAGES.CLI.EXECUTION_FAILED
    case 'CLI_BAD_JSON':
      return ERROR_MESSAGES.CLI.OUTPUT_PARSE_ERROR
    case 'CLI_TIMEOUT':
      return ERROR_MESSAGES.GENERIC.TIMEOUT
    case 'NOT_AUTHENTICATED':
      return ERROR_MESSAGES.AUTH.AUTH_REQUIRED
    default:
      return ERROR_MESSAGES.GENERIC.UNEXPECTED
  }
}

/**
 * エラーオブジェクトからメッセージを抽出
 * @param error - エラーオブジェクト
 */
export function extractErrorMessage(error: any): string {
  if (typeof error === 'string') return error

  if (typeof error === 'object' && error !== null) {
    if ('message' in error) return error.message
    if ('code' in error) return mapCliErrorToMessage(error.code, error.message)
  }

  return ERROR_MESSAGES.GENERIC.UNEXPECTED
}
