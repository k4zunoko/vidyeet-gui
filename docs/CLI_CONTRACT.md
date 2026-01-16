# CLI Contract (`vidyeet-cli.exe`)

本アプリは `bin/vidyeet-cli.exe` を実行して動作します。

## 実行方法

- 開発時: リポジトリの `bin/vidyeet-cli.exe`
- 配布時: アプリ同梱の `bin/vidyeet-cli.exe`（パス解決はMainで吸収）

CLI は以下の形式で呼び出す:

- `vidyeet-cli.exe [--machine] <command> [args...]`

GUIからは原則 `--machine` を付与し、JSONを stdout から受け取る。

## コマンド一覧（helpより）

- `login` / `logout`
- `status`
- `list`
- `show <asset_id>`
- `delete <asset_id> [--force]`
- `upload <file> [--progress]`

## JSON 出力（最低限の依存）

### `--machine status`

想定例（実機確認済み）:

- `success: boolean`
- `is_authenticated: boolean`
- `token_id?: string`（GUIは表示しない/ログに出さない）

GUIの判定は以下で行う:

- `success === true` かつ `is_authenticated === true` → 認証済み
- それ以外 → 未認証扱い（ログイン導線）

### `--machine list`

想定例（実機確認済み）:

- `success: boolean`
- `data: Array<asset>`
- 各 asset から最低限必要:
  - `id: string`（asset id）
  - `playback_ids: Array<{ id: string, policy?: string }>` の先頭の `id`（playback_id）

GUIは以下を前提にする:

- `success !== true` の場合は一覧取得失敗
- `data` が配列でない場合は契約違反として扱い、エラー表示
- `playback_ids` が空の場合、そのassetは「再生不可」として表示（or 非表示）

## `--machine delete <asset_id> --force`

- GUIは安全側に倒し、現状は常に `--force` を付与して削除を実行する
- 破壊的操作のため、GUI側で確認ダイアログを必須にする

### 成功時JSON（想定）

- `success: true`

### 失敗時JSON（想定）

- `success: false`
- `error: { message: string; exit_code: number; hint?: string }`

## `--machine upload <file> --progress`

アップロードは進捗を逐次出すため、stdout は「改行区切りの JSON ストリーム」になる。

GUI側の前提（現実装）:

- stdout は 1行 = 1JSON とは限らないが、概ね改行区切りで進捗/完了が流れる
- JSONとしてパースできない断片は無視して良い（部分的なバッファ分割の可能性）
- GUI の UI 表示は要件変更により「チャンク番号のテキスト表示（例: チャンク完了: 3 / 10）」を行わないようになりました。
  - ただし `current_chunk` / `total_chunks` が出力される場合でも内部ロジック（プログレス補間の Warmup 等）で利用します。
  - ユーザーに見せる進捗は主に bytes ベース（`bytes_sent` / `total_bytes`）により算出されます。

### 進捗行JSON（現実装が参照する形）

- `phase: { phase: string; file_name?: string; size_bytes?: number; format?: string; upload_id?: string; percent?: number; current_chunk?: number; total_chunks?: number; bytes_sent?: number; total_bytes?: number; elapsed_secs?: number }`

GUIは `phase.phase` を表示用の状態として扱うが、表示文言（日本語）は Renderer 側でローカライズします。UI上は以下の点を注意してください:

- 「チャンクのテキスト出力（X / Y）」は削除済み。ただしプログラム的なチャンク情報は継続して受け取り、補間ロジックで利用する。
- 実ユーザーに見せる進捗は bytes ベースのパーセンテージを優先する（`bytes_sent` / `total_bytes`）。
- 補間（Progress Interpolation）が有効な場合、表示パーセンテージは推定値となる。UI上で必要に応じて「推定値」であることを明示する文言を出す。

### 進捗フェーズの種類（説明を更新）

| フェーズ | 説明 | 追加フィールド |
|---------|------|---------------|
| `validating_file` | ファイル検証中 | `file_path` |
| `file_validated` | ファイル検証完了 | `file_name`, `size_bytes`, `format` |
| `creating_direct_upload` | アップロード準備中（アップロードURL生成等） | `file_name` |
| `direct_upload_created` | アップロード準備完了（直接アップロード先の情報受領） | `upload_id` |
| `uploading_file` | アップロード中（全体初期化 / Warmup） | `file_name`, `size_bytes`, `total_chunks?` |
| `uploading_chunk` | 実データ送信中（部分的な bytes 情報を受信） | `bytes_sent`, `total_bytes`, `current_chunk?`, `total_chunks?` |
| `file_uploaded` | ファイル送信完了（サーバ側受領済み） | `file_name`, `size_bytes` |
| `waiting_for_asset` | Mux 側でアセット作成待ち（処理中） | `upload_id`, `elapsed_secs?` |
| `completed` | 処理完了（アセット ID 取得） | `asset_id` |

注記:
- `uploading_file` の説明は以前の「アップロード開始/準備」から明示的に「アップロード中（初期化/ウォームアップ）」に合わせて更新されています。GUI のフェーズ文言もこれに合わせて `アップロード中...` 等に変更されています。
- `uploading_chunk` フェーズでは、GUI は主に `bytes_sent` / `total_bytes` を参照してパーセンテージを計算します。`current_chunk` / `total_chunks` が付与される場合は補間のヒント（Warmup）として扱いますが、数値の直接的なテキスト表示は行いません。

### `uploading_chunk` フェーズの詳細（GUI の扱い）

GUIはこのフェーズでプログレスバーを表示する。現実装の前提:

- 可能であれば `bytes_sent` と `total_bytes` を送ってください。GUIはそれらを用いて厳密なパーセンテージを算出します。
- CLI が大きなチャンク（例: 16MB 単位）でしか報告しない場合、Renderer 側で補間（Progress Interpolation）を行い、滑らかな進捗表示を実現します。補間の詳細は docs/PROGRESS_INTERPOLATION_IMPLEMENTATION.md を参照してください。
- `current_chunk` / `total_chunks` は補間の Warmup 初期化（最初の chunk 完了までの推定）に利用される可能性がありますが、UI に直接表示されることはありません。

サンプル（1行）:

{"phase":{"phase":"uploading_chunk","bytes_sent":3145728,"total_bytes":10485760}}

- GUIはパーセンテージを `(bytes_sent / total_bytes) * 100` で計算し、必要に応じて補間を掛け合わせます。

### 完了行JSON（現実装が参照する形）

- `success: true`
- `asset_id: string`

### 失敗行JSON（現実装が参照する形）

- `success: false`
- `error: { message?: string; ... }`

## 失敗時の扱い

GUI側（Main）が扱うエラー源:

- CLI が存在しない/起動できない
- exit code 非0
- stdout が JSON でない/パース不能
- タイムアウト

これらは統一したエラー型に変換し、UIは「ログインへ誘導」「再試行」「詳細表示」に収束させる。

詳細は [ERROR_HANDLING.md](./ERROR_HANDLING.md)。

## 標準入力（login）について

CLI は `login --stdin` により、標準入力から認証情報を受け取れます。

### `--machine login --stdin`

- 入力フォーマット: 1行目 = Token ID / 2行目 = Token Secret

例（PowerShell 表記等は説明書きのため省略）:

    echo -e "your-token-id\nyour-token-secret" | vidyeet-cli --machine login --stdin

GUIとしては、ユーザー入力（または開発時は環境変数）を受け取り、Main process で stdin に流し込む方式で不足ありません。

### 成功時JSON（実機確認済み）

- `command: "login"`
- `success: true`

### 失敗時JSON（実機確認済み）

失敗時も `--machine` 指定なら stdout にJSONを返します。

- `success: false`
- `error: { message: string; exit_code: number; hint?: string }`

`--machine` 指定時は stderr に人間向けエラーを出さない前提で実装します（ノイズがある場合はCLI側の契約違反として扱う）。

## `.env` について（開発用）

開発時に `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` を `.env` に置く運用は可能ですが、秘密情報のため必ずGit管理から除外します（本リポジトリは `.gitignore` で除外済み）。

## URL 生成（Mux）

`playback_id` からURLを生成する。

- Thumbnail: `https://image.mux.com/{PLAYBACK_ID}/thumbnail.jpg?width=320`
- GIF: `https://image.mux.com/{PLAYBACK_ID}/animated.gif?width=320`
- HLS: `https://stream.mux.com/{PLAYBACK_ID}.m3u8`
- MP4: `https://stream.mux.com/{PLAYBACK_ID}/highest.mp4`

この生成ロジックは Renderer 側に置くが、ドメインやパス形式が変わった時に差し替えやすいよう、定数/ヘルパに閉じ込める。

---
補足:
- 本ドキュメントは Renderer 側の表示ロジック（UX）変更に合わせて更新されています。特に「チャンク番号のテキスト表示」は削除され、進捗は主に bytes ベースで扱われることに注意してください。
- 実装者は CLI の進捗出力が bytes 情報を含むよう配慮すると、GUI 側の正確な表示と補間が容易になります。