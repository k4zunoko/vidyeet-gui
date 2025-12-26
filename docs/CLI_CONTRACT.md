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

例:

```sh
echo -e "your-token-id\nyour-token-secret" | vidyeet-cli --machine login --stdin
```

PowerShell例:

```powershell
"$env:MUX_TOKEN_ID`n$env:MUX_TOKEN_SECRET" | .\bin\vidyeet-cli.exe --machine login --stdin
```

GUIとしては、ユーザー入力（または開発時は環境変数）を受け取り、Main process で stdin に流し込む方式で不足ありません。

### 成功時JSON（実機確認済み）

- `command: "login"`
- `success: true`

### 失敗時JSON（実機確認済み）

失敗時も `--machine` 指定なら stdout にJSONを返します。

- `success: false`
- `error: { message: string; exit_code: number; hint?: string }`

`--machine` 指定時は stderr に人間向けエラーを出さない前提で実装します（ノイズがある場合はCLI側の契約違反として扱う）。

### `.env` について（開発用）

開発時に `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` を `.env` に置く運用は可能ですが、秘密情報のため必ずGit管理から除外します（本リポジトリは `.gitignore` で除外済み）。

## URL 生成（Mux）

`playback_id` からURLを生成する。

- Thumbnail: `https://image.mux.com/{PLAYBACK_ID}/thumbnail.jpg?width=320`
- GIF: `https://image.mux.com/{PLAYBACK_ID}/animated.gif?width=320`
- HLS: `https://stream.mux.com/{PLAYBACK_ID}.m3u8`
- MP4: `https://stream.mux.com/{PLAYBACK_ID}/highest.mp4`

この生成ロジックは Renderer 側に置くが、ドメインやパス形式が変わった時に差し替えやすいよう、定数/ヘルパに閉じ込める。
