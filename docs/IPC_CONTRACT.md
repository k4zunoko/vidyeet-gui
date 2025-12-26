# IPC Contract

Renderer（Vue）から Main（Electron）へ要求する操作を IPC として定義します。

## 原則

- Renderer は「低レベルの `ipcRenderer`」を直接使わず、高水準API（`window.vidyeet`）を利用する
- チャネル名は `vidyeet:` プレフィクスで統一
- 戻り値は JSON 互換（構造化データ）に限定し、例外は統一エラーにする

## チャネル一覧（案）

### 認証

- `vidyeet:status`
  - request: なし
  - response: `{ isAuthenticated: boolean }`

- `vidyeet:login`
  - request: `{ tokenId: string; tokenSecret: string }`
  - response: `{ success: true }` またはエラー

- `vidyeet:logout`
  - request: なし
  - response: `{ success: true }`

### ライブラリ

- `vidyeet:list`
  - request: なし
  - response: `{ items: Array<{ assetId: string; playbackId: string | null }> }`

将来:

- `vidyeet:show` / `vidyeet:delete` / `vidyeet:upload`

## エラー応答（統一）

IPC の失敗は以下の形式で返す（Rendererで扱いやすくする）:

- `{ code: string; message: string; details?: unknown }`

コード例:

- `CLI_NOT_FOUND`
- `CLI_NON_ZERO_EXIT`
- `CLI_BAD_JSON`
- `CLI_TIMEOUT`
- `NOT_AUTHENTICATED`

詳細は [ERROR_HANDLING.md](./ERROR_HANDLING.md)。
