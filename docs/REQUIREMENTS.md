# Requirements

## 前提

- 対象OS: Windows（配布物も Windows のみ）
- GUI は `bin/vidyeet-cli.exe`（以下CLI）を実行して動作する
- CLI は `--machine` オプションで機械可読 JSON を stdout に返す
- 認証情報の保存/管理は CLI の責務（GUIは成功/失敗のみ扱う）

## 現スコープ（MVP）

### 認証

- 起動時に `--machine status` を実行し、認証済みか判定する
- 未認証の場合、ユーザーが認証情報を入力する画面を表示する
  - 認証に成功するまで一覧画面には進めない

### 動画一覧

- 認証済みの状態で `--machine list` を実行し、アップロード済み動画を取得する
- 一覧は「動画（asset）」単位で表示する
- 各動画の表示に最低限必要な情報:
  - asset id（選択/詳細取得/削除等の将来拡張に利用）
  - `playback_id`（サムネイル/GIF/HLS URLの生成に利用）

### プレビュー表示

- サムネイルの一覧表示
- ホバー時に GIF を表示（可能ならホバー中のみ）
- 選択時に HLS を再生

Mux の再生/画像URLは `playback_id` から以下で生成する:

- Thumbnail: `https://image.mux.com/{PLAYBACK_ID}/thumbnail.{png|jpg|webp}?width=320`
- Animated GIF: `https://image.mux.com/{PLAYBACK_ID}/animated.gif?width=320`
- HLS: `https://stream.mux.com/{PLAYBACK_ID}.m3u8`

※ URLドメインはMux仕様に依存するため、将来差し替え可能な定数として扱う。

## 非機能要件

### レスポンス/操作性

- CLI 呼び出しは UI を固めない（呼び出し中はローディング状態を出す）
- タイムアウト/キャンセルを持ち、無限待ちを避ける

### セキュリティ

- Renderer から OS 操作や CLI 起動は行わない（Main が担当）
- 認証情報は最小限の期間のみ保持し、ログには出さない

### ネットワーク/プロキシ

- 企業プロキシ環境を想定し、環境変数（例: `HTTP_PROXY`/`HTTPS_PROXY`）を阻害しない
- 画像/GIF/HLS の取得失敗時はプレースホルダやエラーメッセージで復帰可能にする

## 将来スコープ（候補）

- 右クリックメニューから削除（`delete <asset_id>`）
- MP4 URL のコピー（`show <asset_id>` の情報を利用）
- アップロード（`upload <file> --progress`）

詳細は [ROADMAP.md](./ROADMAP.md)。
