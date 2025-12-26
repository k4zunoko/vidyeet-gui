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

### Preload

- IPCチャネルを隠蔽し、型付きの高水準APIを `window.vidyeet` として公開する（予定）
- 既存の `window.ipcRenderer` 直接露出は将来的に段階的に縮小する

### Main

- CLI のパス解決（開発時/ビルド後の差異吸収）
- `child_process` による CLI 起動
- タイムアウト、キャンセル、stdout JSON のパース
- 異常系（CLI未存在、JSON不正、exit code非0）を統一エラーにマッピング

## データフロー（MVP）

1. Renderer 起動
2. `status` を Main に要求
3. 認証済みなら `list` を要求
4. 一覧を Renderer に返し表示
5. ユーザーが動画選択→HLS URL を生成して再生

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
  - `types/*`: 画面が必要とする最小型

※ これは方針であり、実装時に最小の追加で進める。

## 設計の要点

- CLI出力の取り込みは Main に集約し、Renderer は「UIに必要な最小形」だけを受け取る
- 例外/エラー形を統一し、UIは分岐を最小化する

CLI契約は [CLI_CONTRACT.md](./CLI_CONTRACT.md)、IPCは [IPC_CONTRACT.md](./IPC_CONTRACT.md) を参照。
