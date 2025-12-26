



# vidyeet-gui DESIGN PHILOSOPHY

このドキュメントは、vidyeet-gui（Windows専用 / Vue + Electron + TypeScript）の設計判断を固定し、今後の機能追加（アップロード/削除/コピー等）を安全に拡張するための「上流の合意」をまとめます。

## 目的

- Mux Video への動画管理を、GUIで安全・快適に行えるようにする
- 既存の CLI（`bin/vidyeet-cli.exe`）を単一の業務ロジックとして活用し、GUI側は表示/操作/進行管理に集中する
- 失敗・再試行・ネットワーク制約（プロキシ等）を前提に、ユーザーが迷わない状態遷移を提供する

## スコープ（現時点）

- 認証状態確認（`--machine status`）→未認証ならログイン導線
- 動画一覧取得（`--machine list`）
- サムネイル一覧表示（ホバーでGIF、選択でHLS再生）

現実装に含まれる拡張:

- ログアウト（`--machine logout`）
- 右クリックメニュー
	- MP4リンクコピー（`playback_id` から生成）
	- 削除（`--machine delete <asset_id> --force`、確認ダイアログ必須）
- アップロード（`--machine upload <file> --progress`、進捗表示 + 完了後リロード）
- フレームレスウィンドウ（カスタムタイトルバー + window control API）

将来拡張の候補は [ROADMAP.md](./ROADMAP.md) に切り出します。

## 非目標（現時点でやらない）

- Mux API をGUI側で直接叩く（CLIが責務を持つ）
- 認証情報の保存方式をGUIが管理する（CLIが担保する）
- クロスプラットフォーム対応（Windows専用）

補足:

- `show` による詳細取得・URLコピー拡張（HLS/サムネ等）は将来対応

## 設計原則

### 1) CLI が単一の真実（Single Source of Truth）

- Mux とのやり取り・認証情報・状態管理は CLI が担う
- GUI は CLI の JSON 出力を表示用に整形するだけに留める

理由: API実装や認証の責務をGUIに持たせると、二重実装になり保守・障害対応が難しくなるため。

### 2) Renderer は信用しない（Electronの安全境界）

- CLI実行（プロセス起動）、ファイルアクセス、OS依存処理は main process が担当
- Renderer（Vue）はUI状態管理に限定し、直接 Node API に触れない
- Preload は `contextBridge` による最小APIのみ公開する

理由: Electronにおける最小権限と、脆弱性影響範囲の縮小。

### 3) “壊れても分かる” エラーハンドリング

- エラーは「ユーザーが取れる行動」に変換して提示する
- CLIの失敗（exit code非0 / JSON不正 / タイムアウト）は、再試行/ログイン/詳細表示に収束させる

詳細は [ERROR_HANDLING.md](./ERROR_HANDLING.md)。

### 4) 小さな契約で前進する（JSON契約の最小依存）

- `--machine` の出力は将来拡張されうるため、GUI側が依存するフィールドは最小化する
- 想定外フィールドは無視し、必須フィールド欠落時のみエラーにする

詳細は [CLI_CONTRACT.md](./CLI_CONTRACT.md)。

## レイヤ構成（責務と境界）

- Renderer（Vue）
	- 画面描画、ユーザー入力、一覧の表示状態、再生状態
	- main/preload越しに「状態取得」「一覧取得」「ログイン」などを呼ぶ

- Preload
	- `contextBridge` で安全な API を公開（低レベル IPC は隠蔽）

- Main process
	- CLI プロセス起動、stdout JSON のパース、タイムアウト（明示的なキャンセル操作は未実装）
	- 画面が必要とする形へ整形して返す（ただし“業務ロジック”は増やしすぎない）

この境界の具体は [ARCHITECTURE.md](./ARCHITECTURE.md) と [IPC_CONTRACT.md](./IPC_CONTRACT.md)。

## 初期化フロー（起動時）

1. `--machine status` で認証状態を確認
2. 未認証の場合はログイン導線（トークン/パスワード等の入力）
3. 認証成功後に `--machine list` で動画一覧取得
4. 一覧からサムネイル表示
5. 選択でHLS再生（Muxの `playback_id` からURL生成）

画面と状態遷移は [UI_SPEC.md](./UI_SPEC.md) と [REQUIREMENTS.md](./REQUIREMENTS.md) を参照。

## 変更に強いポイント

- CLIのコマンドやJSONの差分を main 側のアダプタに閉じ込め、Renderer へ波及させない
- まず `status` / `list` を安定化し、`show` / `delete` / `upload` は段階的に追加する



