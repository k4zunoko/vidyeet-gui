# Architecture

## 全体構成

- Vue 3（Renderer）: UI、状態管理、ユーザー操作
- Electron Preload: 安全なAPI公開（contextBridge）
- Electron Main: CLI実行、JSONパース、IPCハンドラ
- CLI（`bin/vidyeet-cli.exe`）: Mux API 操作と認証情報の取り扱い

## 責務分離

### Renderer

- 画面状態: 認証状態、一覧、選択中動画、ローディング/エラー
- URL生成: `playback_id` から thumbnail/gif/hls を生成
- Mainへ依頼: `status` / `list` / `login` など

現実装の追加:

- 右クリックメニュー: MP4 URL の生成・コピー（クリップボード書き込みは Preload API 経由）
- 削除/アップロードの操作とダイアログ表示
- アップロードキュー: 複数ファイルの逐次アップロード管理（`useUploadQueue` composable）

### Preload

- IPCチャネルを隠蔽し、型付きの高水準APIを公開する
  - `window.vidyeet`（status/login/logout/list/delete/selectFile/upload）
  - `window.clipboard`（writeText）
  - `window.windowControl`（minimize/maximize/close/isMaximized）
  - `window.updater`（checkForUpdates/downloadUpdate/quitAndInstall/onStatus）
- 互換のため `window.ipcRenderer` も公開されているが、新規コードでは使用禁止（段階的に廃止）

### Main

- CLI のパス解決（開発時/ビルド後の差異吸収）
- `child_process` による CLI 起動
- タイムアウト、stdout JSON のパース（明示的なキャンセル操作は未実装）
- 異常系（CLI未存在、JSON不正、exit code非0）を統一エラーにマッピング
 - autoUpdater のイベントを Renderer へ中継（手動更新確認の前提）

現実装の追加:

- `delete` / `selectFile` / `upload` のIPCハンドラ
- `upload` は進捗をイベント（`vidyeet:uploadProgress`）でRendererへ送信
- クリップボード書き込み（`clipboard:write`）
- フレームレスウィンドウ操作（`window:*`）

## データフロー（MVP）

1. Renderer 起動
2. `status` を Main に要求
3. 認証済みなら `list` を要求
4. 一覧を Renderer に返し表示
5. ユーザーが動画選択→HLS URL を生成して再生

追加（現実装）:

- 右クリック→コンテキストメニュー→「リンクをコピー」→クリップボード書き込み
- 右クリック→「削除」→確認→`delete`→一覧から除去
- ドロワー→「アップロード」→ファイル選択→`upload`→進捗イベント→完了後 `list` 再実行

## ファイル配置（案）

- `electron/`
  - `main.ts`: BrowserWindow生成 + IPC 登録
  - `preload.ts`: `contextBridge` で `window.vidyeet` を公開
  - `services/cliRunner.ts`: CLI実行共通（spawn/timeout/json）
  - `services/vidyeetClient.ts`: `status/list/show/delete/upload` の薄いアダプタ

- `src/`
  - `features/auth/*`: 認証画面
  - `features/library/*`: 一覧とサムネイル
  - `features/player/*`: HLS再生
  - `composables/useUploadQueue.ts`: アップロードキュー管理
  - `composables/useProgressInterpolation.ts`: 進捗補間（滑らかな表示）
  - `types/*`: 画面が必要とする最小型（キューアイテム含む）

※ これは方針であり、実装時に最小の追加で進める。

## 設計の要点

- CLI出力の取り込みは Main に集約し、Renderer は「UIに必要な最小形」だけを受け取る
- 例外/エラー形を統一し、UIは分岐を最小化する

補足（現実装の状況）:

- `status/login/logout/list/delete` は共通Runner（タイムアウト/JSONパース/統一エラー）を利用
- `upload` は進捗のストリーム処理のため別実装（将来的に共通化の余地あり）
- 複数ファイルアップロード: Renderer側でキュー管理し、CLIは1ファイルずつ逐次実行

## 配布（CLI同梱）

- `electron-builder` の `extraResources` により `bin/vidyeet-cli.exe` を同梱する
- 配布後は `process.resourcesPath/bin/vidyeet-cli.exe` を実行する

CLI契約は [CLI_CONTRACT.md](./CLI_CONTRACT.md)、IPCは [IPC_CONTRACT.md](./IPC_CONTRACT.md) を参照。

## アップロードキュー管理（Phase 1実装済み）

複数ファイルのアップロードを逐次実行するキューシステム。

### 設計方針

- **逐次実行**: 1ファイルずつアップロード（CLIプロセスは並列実行しない）
- **エラー継続**: 1ファイル失敗しても次のファイルを処理
- **個別リロード**: 各ファイル成功時に一覧を更新
- **Reactiveな状態管理**: UIとシームレスに連携

### 実装箇所

- `src/composables/useUploadQueue.ts`: キュー管理のcomposable
- `src/types/app.ts`: `QueueItem`, `QueueItemStatus`, `QueueStats` 型定義
- `src/App.vue`: キュー統合、複数ファイルハンドリング、UI表示

### データフロー

1. ユーザーが複数ファイルを選択（ファイル選択ダイアログまたはドラッグ&ドロップ）
2. `useUploadQueue.enqueue()` でキューに追加
3. `processUploadQueue()` がキューから1つ取り出し
4. 既存の `upload` IPC呼び出しを実行（進捗補間も動作）
5. 成功: `markCurrentCompleted()` → 一覧リロード → 次のファイル処理
6. 失敗: `markCurrentError()` → トースト表示 → 次のファイル処理
7. キュー完了時: 全体のトースト表示 → キューをクリア

### 状態管理

- `items`: キューアイテムのリスト（waiting/uploading/completed/error）
- `currentItem`: 現在アップロード中のアイテム
- `stats`: 統計情報（総数、待機中、完了、エラー）
- `isProcessing`: キューが実行中かどうか

### UI表示

- ダイアログヘッダー: 「アップロード中 (2/5)」形式で進捗表示
- 現在のファイル: プログレスバー + フェーズテキスト
- 待機中リスト: ファイル名 + キャンセルボタン
- 最小化バー: 単一ファイルは進捗率、複数ファイルは件数表示

詳細は [UI_SPEC.md](./UI_SPEC.md) のアップロードダイアログセクションを参照。
