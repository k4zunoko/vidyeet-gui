# IPC Contract

Renderer（Vue）から Main（Electron）へ要求する操作を IPC として定義します。

## 原則

- Renderer は「低レベルの `ipcRenderer`」を直接使わず、高水準API（`window.vidyeet`）を利用する
- Vidyeet操作のチャネル名は `vidyeet:` プレフィクスで統一（補助用途として `clipboard:` / `window:` も存在する）
- 戻り値は JSON 互換（構造化データ）に限定し、例外は統一エラーにする

補足（現実装）:

- `window.vidyeet` / `window.clipboard` / `window.windowControl` は Preload で `contextBridge` 経由で公開される
- 互換のため `window.ipcRenderer` も公開されているが、**新規コードでは使用禁止**（段階的に廃止予定）

## チャネル一覧（現実装）

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
  - response: `{ items: Array<{ assetId: string; playbackId: string | null; duration?: number; status?: string; resolutionTier?: string; aspectRatio?: string; maxFrameRate?: number; createdAt?: string }> }`

- `vidyeet:delete`
  - request: `{ assetId: string }`
  - response: `{ success: true }` またはエラー

### アップロード

- `vidyeet:selectFile`
  - request: なし
  - response: `{ filePath: string | null }` またはエラー

- `vidyeet:upload`
  - request: `{ filePath: string }`
  - response: `{ success: true; assetId: string }` またはエラー

イベント:

- `vidyeet:uploadProgress`（Main → Renderer）
  - payload: `{ phase: string; fileName?: string; sizeBytes?: number; format?: string; uploadId?: string; percent?: number }`

### クリップボード

- `clipboard:write`
  - request: `text: string`
  - response: `void`

### ウィンドウ操作（フレームレス）

※ 現状、チャネルは `vidyeet:` ではなく `window:` プレフィクス。

- `window:minimize` → `void`
- `window:maximize` → `void`（最大化/復帰をトグル）
- `window:close` → `void`
- `window:isMaximized` → `boolean`

将来（候補）:

- `vidyeet:show`（詳細取得）

## エラー応答（統一）

IPC の失敗は以下の形式で返す（Rendererで扱いやすくする）:

- `{ code: string; message: string; details?: unknown }`

現実装では、IPCハンドラは「throw ではなく、上記のエラーオブジェクトを戻り値として返す」方針。
Renderer は `isIpcError()` ガードで分岐する。

コード例:

- `CLI_NOT_FOUND`
- `CLI_NON_ZERO_EXIT`
- `CLI_BAD_JSON`
- `CLI_TIMEOUT`
- `NOT_AUTHENTICATED`

詳細は [ERROR_HANDLING.md](./ERROR_HANDLING.md)。
