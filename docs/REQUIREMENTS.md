# Requirements

## 前提

- 対象OS: Windows（配布物も Windows のみ）
- GUI は `bin/vidyeet-cli.exe`（以下CLI）を実行して動作する
- CLI は `--machine` オプションで機械可読 JSON を stdout に返す
- 認証情報の保存/管理は CLI の責務（GUIは成功/失敗のみ扱う）

## 現スコープ（現実装）

### 認証

- 起動時に `--machine status` を実行し、認証済みか判定する
- 未認証の場合、ユーザーが認証情報を入力する画面を表示する
  - 認証に成功するまで一覧画面には進めない

### 動画一覧

- 認証済みの状態で `--machine list` を実行し、アップロード済み動画を取得する
- 一覧は「動画（asset）」単位で表示する
- 各動画の表示に最低限必要な情報:
  - asset id（選択/削除に利用）
  - `playback_id`（サムネイル/GIF/HLS/MP4 URLの生成に利用）
- 可能なら一覧の追加メタ情報も表示に利用できる（duration/status 等）

### プレビュー表示

- サムネイルの一覧表示
- ホバー時に GIF を表示（可能ならホバー中のみ）
- 選択時に HLS を再生
- 選択中の動画について、最小限のメタ情報（時間/解像度/作成日など）を表示できる

Mux の再生/画像URLは `playback_id` から以下で生成する:

- Thumbnail: `https://image.mux.com/{PLAYBACK_ID}/thumbnail.{png|jpg|webp}?width=320`
- Animated GIF: `https://image.mux.com/{PLAYBACK_ID}/animated.gif?width=320`
- HLS: `https://stream.mux.com/{PLAYBACK_ID}.m3u8`
- MP4: `https://stream.mux.com/{PLAYBACK_ID}/highest.mp4`

※ URLドメインはMux仕様に依存するため、将来差し替え可能な定数として扱う。

### 右クリックメニュー（コンテキストメニュー）

- ライブラリの動画カード（再生可能なもの）で右クリックすると、コンテキストメニューを表示する
- プレイヤー領域（選択中動画あり）でも右クリックでメニューを表示できる
- メニュー項目（現実装）:
  - 「リンクをコピー」: `playback_id` から MP4 URL を生成してクリップボードへコピー
  - 「削除」: 削除確認ダイアログを出し、承認されたら削除

### 削除

- `--machine delete <asset_id> --force` を実行し、動画（asset）を削除する
- 削除は取り消せないため、GUIは確認ダイアログ（意図的な壁）を必須にする
- 削除成功時:
  - 一覧から当該アイテムを除去する
  - 選択中の動画が削除された場合は選択解除する

### アップロード

- ドロワーメニューからアップロードを開始できる
- ファイル選択ダイアログで動画ファイルを1つ選択する（キャンセル可能）
- `--machine upload <file> --progress` を実行し、進捗をUIに表示する
- 完了後は一覧を再読み込みする

## 非機能要件

### レスポンス/操作性

- CLI 呼び出しは UI を固めない（呼び出し中はローディング状態を出す）
- タイムアウトを持ち、無限待ちを避ける（現状、明示的なキャンセル操作は未実装）

補足（現実装）:

- `status/list/login/logout/delete` は共通Runnerでタイムアウト（30秒）を持つ
- `upload` は進捗のストリーム処理のため、現状は別実装でタイムアウトを持たない（将来の改善候補）

### セキュリティ

- Renderer から OS 操作や CLI 起動は行わない（Main が担当）
- 認証情報は最小限の期間のみ保持し、ログには出さない

補足（現実装）:

- クリップボード書き込みは Preload 経由の `window.clipboard` API に限定する
- ウィンドウ操作（最小化/最大化/閉じる）は Preload 経由の `window.windowControl` API に限定する

### ネットワーク/プロキシ

- 企業プロキシ環境を想定し、環境変数（例: `HTTP_PROXY`/`HTTPS_PROXY`）を阻害しない
- 画像/GIF/HLS の取得失敗時はプレースホルダやエラーメッセージで復帰可能にする

## 将来スコープ（候補）

- `show <asset_id>` による詳細取得（一覧にない情報を表示する）
- URLコピーの拡張（HLS/サムネイル等もコピー対象にする）
- アップロードの再試行/キャンセル/タイムアウトなど運用向けの強化

詳細は [ROADMAP.md](./ROADMAP.md)。
