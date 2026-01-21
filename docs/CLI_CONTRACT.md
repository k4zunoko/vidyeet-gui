# vidyeet-cli Machine API リファレンス

**バージョン**: 1.1  
**対象**: プログラムからvidyeet-cliを呼び出す開発者向け

---

## バージョン履歴

### v1.1
- **変更内容**: `uploading_file` フェーズに `total_chunks` フィールドを追加
- **理由**: GUI実装でプログレスバーを準備する際に、総チャンク数を事前に把握できるようにするため
- **互換性**: 非破壊的変更（フィールド追加のみ）。既存のパーサーは未知のフィールドを無視できます
- **影響**: 厳密な型チェックを行っているクライアントは型定義の更新が必要

### v1.0
- 初版リリース

---

## 概要

`--machine`フラグを使用すると、vidyeet-cliのすべてのコマンドが機械可読なJSON形式で出力されます。このドキュメントでは、各コマンドの入出力仕様、エラーハンドリング、進捗通知の詳細を説明します。

### 主な特徴

- **構造化されたJSON出力**: すべてのコマンドが一貫したJSON形式で応答
- **エラーの構造化**: 失敗時もJSON形式で詳細なエラー情報を提供
- **終了コードの標準化**: エラーの種類に応じた明確な終了コード
- **進捗通知のストリーミング**: アップロード時のリアルタイム進捗情報（JSONL形式）
- **標準入出力の活用**: stdinからの認証情報入力、stdoutへのJSON出力

---

## 基本的な使用方法

### コマンド構文

```powershell
vidyeet --machine <command> [args...]
```

**重要**: `--machine`はグローバルフラグのため、必ずコマンド名の**前**に指定してください。

### 出力の特性

- **成功時**: stdoutにJSON形式でレスポンスを出力（終了コード0）
- **失敗時**: stdoutにエラーJSONを出力し、適切な終了コードで終了
- **進捗情報**: `--progress`フラグと組み合わせると、stdoutにJSONL形式で進捗を出力

---

## 終了コード

vidyeet-cliは、エラーの種類に応じて以下の終了コードを返します。

| 終了コード | 分類 | 説明 | 例 |
|----------|------|------|-----|
| `0` | 成功 | コマンドが正常に完了 | アップロード成功、ログイン成功 |
| `1` | ユーザーエラー | ユーザー入力や操作の問題 | ファイルが存在しない、無効なアセットID |
| `2` | 設定エラー | 認証情報や設定の問題 | 未ログイン、認証情報が無効 |
| `3` | システムエラー | ネットワークやAPI側の問題 | API接続失敗、タイムアウト |

---

## コマンドリファレンス

### 1. login - ログイン

Mux APIの認証情報を設定します。

#### 構文

```powershell
echo "$TOKEN_ID`n$TOKEN_SECRET" | vidyeet --machine login --stdin
```

#### 標準入力の形式

```
<TOKEN_ID>
<TOKEN_SECRET>
```

**注意**: 改行で区切られた2行の入力が必要です。

#### 成功時のレスポンス

```json
{
  "success": true,
  "command": "login",
  "was_logged_in": false,
  "action": "created"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `success` | boolean | 常に`true` |
| `command` | string | コマンド名（"login"） |
| `was_logged_in` | boolean | 既にログイン済みだった場合`true` |
| `action` | string | `"created"`（新規）または`"updated"`（上書き） |

#### 失敗時のレスポンス

```json
{
  "success": false,
  "error": {
    "message": "Login command failed",
    "exit_code": 2,
    "hint": "Please check your access token credentials."
  }
}
```

---

### 2. status - ステータス確認

現在の認証状態を確認します。

#### 構文

```powershell
vidyeet --machine status
```

#### 成功時のレスポンス（認証済み）

```json
{
  "success": true,
  "command": "status",
  "is_authenticated": true,
  "token_id": "abc***xyz"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `success` | boolean | 常に`true` |
| `command` | string | コマンド名（"status"） |
| `is_authenticated` | boolean | 認証済みの場合`true` |
| `token_id` | string \| null | マスキングされたToken ID（認証済みの場合） |

#### 成功時のレスポンス（未認証）

```json
{
  "success": true,
  "command": "status",
  "is_authenticated": false,
  "token_id": null
}
```

---

### 3. upload - 動画アップロード

動画ファイルをMuxにアップロードします。

#### 構文

```powershell
vidyeet --machine upload <file_path> [--progress]
```

#### 引数

- `file_path`: アップロードする動画ファイルのパス（必須）
- `--progress`: 進捗情報をJSONL形式で出力（オプション）

#### 成功時のレスポンス

```json
{
  "success": true,
  "command": "upload",
  "asset_id": "abc123xyz456",
  "playback_id": "xyz789",
  "hls_url": "https://stream.mux.com/xyz789.m3u8",
  "mp4_url": "https://stream.mux.com/xyz789/highest.mp4",
  "mp4_status": "ready",
  "file_path": "video.mp4",
  "file_size": 10485760,
  "file_format": "mp4",
  "deleted_old_videos": 0
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `success` | boolean | 常に`true` |
| `command` | string | コマンド名（"upload"） |
| `asset_id` | string | Muxで生成されたアセットID |
| `playback_id` | string \| null | 再生ID（HLS/MP4のURL構築に使用） |
| `hls_url` | string \| null | HLS再生URL（すぐに利用可能） |
| `mp4_url` | string \| null | MP4ダウンロードURL |
| `mp4_status` | string | MP4のステータス（`"ready"`または`"generating"`） |
| `file_path` | string | アップロードしたファイルパス |
| `file_size` | number | ファイルサイズ（バイト） |
| `file_format` | string | ファイル形式（拡張子） |
| `deleted_old_videos` | number | 削除された古い動画の数 |

#### MP4ステータスの種類

- `ready`: MP4がすぐに利用可能
- `generating`: MP4がバックグラウンドで生成中（HLSは利用可能）

#### 進捗通知（`--progress`指定時）

`--progress`フラグを指定すると、アップロード中の進捗情報がJSONL形式（1行1JSON）でstdoutに出力されます。最終的な成功レスポンスもJSONで出力されるため、各行を個別にパースする必要があります。

##### 進捗JSONの形式

```json
{"phase":"validating_file","file_path":"video.mp4"}
{"phase":"file_validated","file_name":"video.mp4","size_bytes":10485760,"format":"mp4"}
{"phase":"creating_direct_upload","file_name":"video.mp4"}
{"phase":"direct_upload_created","upload_id":"abc123"}
{"phase":"uploading_file","file_name":"video.mp4","size_bytes":10485760,"total_chunks":10}
{"phase":"uploading_chunk","current_chunk":1,"total_chunks":10,"bytes_sent":1048576,"total_bytes":10485760}
{"phase":"file_uploaded","file_name":"video.mp4","size_bytes":10485760}
{"phase":"waiting_for_asset","upload_id":"abc123","elapsed_secs":5}
{"phase":"completed","asset_id":"abc123xyz"}
```

##### 進捗フェーズの種類

| フェーズ | 説明 | 追加フィールド |
|---------|------|---------------|
| `validating_file` | ファイル検証中 | `file_path` |
| `file_validated` | ファイル検証完了 | `file_name`, `size_bytes`, `format` |
| `creating_direct_upload` | アップロードURL作成中 | `file_name` |
| `direct_upload_created` | アップロードURL作成完了 | `upload_id` |
| `uploading_file` | アップロード開始 | `file_name`, `size_bytes`, `total_chunks` |
| `uploading_chunk` | チャンクアップロード中 | `current_chunk`, `total_chunks`, `bytes_sent`, `total_bytes` |
| `file_uploaded` | アップロード完了 | `file_name`, `size_bytes` |
| `waiting_for_asset` | アセット作成待機中 | `upload_id`, `elapsed_secs` |
| `completed` | 処理完了 | `asset_id` |

---

### 4. list - 動画一覧取得

アップロード済みの動画一覧を取得します。

#### 構文

```powershell
vidyeet --machine list
```

#### 成功時のレスポンス

```json
{
  "success": true,
  "command": "list",
  "data": [
    {
      "id": "asset_abc123",
      "status": "ready",
      "playback_ids": [
        {
          "id": "xyz789",
          "policy": "public"
        }
      ],
      "duration": 123.45,
      "created_at": "1609459200",
      "aspect_ratio": "16:9",
      "video_quality": "basic",
      "resolution_tier": "1080p",
      "encoding_tier": "baseline",
      "tracks": [
        {
          "type": "video",
          "id": "track_001",
          "duration": 123.45,
          "max_width": 1920,
          "max_height": 1080,
          "max_frame_rate": 30.0
        },
        {
          "type": "audio",
          "id": "track_002",
          "duration": 123.45,
          "max_channels": 2,
          "max_channel_layout": "stereo"
        }
      ],
      "static_renditions": {
        "files": [
          {
            "id": "rendition_001",
            "type": "standard",
            "status": "ready",
            "resolution": "highest",
            "name": "highest.mp4",
            "ext": "mp4"
          }
        ]
      }
    }
  ],
  "total_count": 1
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `success` | boolean | 常に`true` |
| `command` | string | コマンド名（"list"） |
| `data` | array | 完全なMux API Asset配列（[AssetData](#assetdata-構造)の配列） |
| `total_count` | number | 動画の総数 |

---

### 5. show - 動画詳細表示

指定したアセットIDの詳細情報を取得します。

#### 構文

```powershell
vidyeet --machine show <asset_id>
```

#### 成功時のレスポンス

```json
{
  "success": true,
  "command": "show",
  "data": {
    "id": "asset_abc123",
    "status": "ready",
    "playback_ids": [
      {
        "id": "xyz789",
        "policy": "public"
      }
    ],
    "duration": 123.45,
    "created_at": "1609459200",
    "updated_at": "1609459300",
    "aspect_ratio": "16:9",
    "video_quality": "basic",
    "resolution_tier": "1080p",
    "encoding_tier": "baseline",
    "max_stored_frame_rate": 30.0,
    "tracks": [
      {
        "type": "video",
        "id": "track_001",
        "duration": 123.45,
        "max_width": 1920,
        "max_height": 1080,
        "max_frame_rate": 30.0
      }
    ],
    "static_renditions": {
      "files": [
        {
          "id": "rendition_001",
          "type": "standard",
          "status": "ready",
          "resolution": "highest",
          "name": "highest.mp4",
          "ext": "mp4"
        }
      ]
    }
  }
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `success` | boolean | 常に`true` |
| `command` | string | コマンド名（"show"） |
| `data` | object | 完全なMux API Asset情報（[AssetData](#assetdata-構造)） |

---

### 6. delete - 動画削除

指定したアセットIDの動画を削除します。

#### 構文

```powershell
vidyeet --machine delete <asset_id> --force
```

**注意**: `--machine`モードでは確認プロンプトが表示されないため、`--force`フラグは不要ですが、明示的に指定することを推奨します。

#### 成功時のレスポンス

```json
{
  "success": true,
  "command": "delete",
  "asset_id": "asset_abc123"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `success` | boolean | 常に`true` |
| `command` | string | コマンド名（"delete"） |
| `asset_id` | string | 削除されたアセットID |

---

### 7. logout - ログアウト

認証情報を削除します。

#### 構文

```powershell
vidyeet --machine logout
```

#### 成功時のレスポンス

```json
{
  "success": true,
  "command": "logout",
  "was_logged_in": true
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `success` | boolean | 常に`true` |
| `command` | string | コマンド名（"logout"） |
| `was_logged_in` | boolean | ログイン済み状態だった場合`true` |

---

## データ構造リファレンス

### AssetData 構造

`list`および`show`コマンドの`data`フィールドで返される完全なMux API Asset情報。

#### 基本フィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | string | アセットID |
| `status` | string | ステータス（`preparing`, `ready`, `errored`） |
| `playback_ids` | array | 再生ID配列（[PlaybackId](#playbackid-構造)） |
| `duration` | number \| null | 動画時間（秒） |
| `created_at` | string | 作成日時（Unix timestamp文字列） |
| `updated_at` | string \| null | 更新日時（Unix timestamp文字列） |
| `aspect_ratio` | string \| null | アスペクト比（例: "16:9"） |
| `video_quality` | string \| null | ビデオ品質（`basic`, `plus`など） |

#### 解像度・品質関連フィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `resolution_tier` | string \| null | 解像度ティア（`1080p`, `720p`, `540p`, `360p`など） |
| `max_stored_resolution` | string \| null | 最大保存解像度（非推奨: `resolution_tier`を使用） |
| `max_stored_frame_rate` | number \| null | 最大保存フレームレート |
| `max_resolution_tier` | string \| null | 最大解像度ティア |

#### エンコーディング関連フィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `encoding_tier` | string \| null | エンコーディングティア（`baseline`, `smart`など） |
| `master_access` | string \| null | マスターファイルアクセス（`none`, `temporary`など） |

#### その他のフィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `passthrough` | string \| null | カスタムメタデータ（最大255文字） |
| `tracks` | array \| null | トラック情報配列（[Track](#track-構造)） |
| `static_renditions` | object \| null | Static Renditions（[StaticRenditionsWrapper](#staticrenditionswrapper-構造)） |

### PlaybackId 構造

```json
{
  "id": "xyz789",
  "policy": "public"
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | string | 再生ID（HLS/MP4のURL構築に使用） |
| `policy` | string | 再生ポリシー（`public`, `signed`など） |

**URL構築例**:
- HLS: `https://stream.mux.com/{playback_id}.m3u8`
- MP4: `https://stream.mux.com/{playback_id}/highest.mp4`

### Track 構造

```json
{
  "type": "video",
  "id": "track_001",
  "duration": 123.45,
  "max_width": 1920,
  "max_height": 1080,
  "max_frame_rate": 30.0
}
```

#### 共通フィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `type` | string | トラックタイプ（`video`, `audio`） |
| `id` | string \| null | トラックID |
| `duration` | number \| null | トラック時間（秒） |

#### ビデオトラック専用フィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `max_width` | number \| null | 最大幅（ピクセル） |
| `max_height` | number \| null | 最大高さ（ピクセル） |
| `max_frame_rate` | number \| null | 最大フレームレート |

#### オーディオトラック専用フィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `max_channels` | number \| null | 最大チャンネル数 |
| `max_channel_layout` | string \| null | 最大チャンネルレイアウト（例: `stereo`） |

### StaticRenditionsWrapper 構造

```json
{
  "files": [
    {
      "id": "rendition_001",
      "type": "standard",
      "status": "ready",
      "resolution": "highest",
      "name": "highest.mp4",
      "ext": "mp4"
    }
  ]
}
```

#### StaticRendition 構造

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | string | Rendition ID |
| `type` | string | Renditionタイプ（例: `standard`） |
| `status` | string | ステータス（`preparing`, `ready`, `errored`, `skipped`, `deleted`） |
| `resolution` | string | 解像度（`highest`, `1080p`, `720p`など） |
| `name` | string | ファイル名（例: `highest.mp4`） |
| `ext` | string | ファイル拡張子（例: `mp4`, `m4a`） |

---

## エラーハンドリング

すべてのコマンドは、失敗時に以下の形式のJSONを出力します。

### エラーレスポンス形式

```json
{
  "success": false,
  "error": {
    "message": "Upload command failed",
    "exit_code": 1,
    "hint": "Please check that the file exists and is accessible."
  }
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `success` | boolean | 常に`false` |
| `error.message` | string | エラーメッセージ |
| `error.exit_code` | number | 終了コード（1, 2, 3） |
| `error.hint` | string \| null | ユーザー向けのヒント（ある場合） |

### エラータイプ別の例

#### ユーザーエラー（終了コード: 1）

```json
{
  "success": false,
  "error": {
    "message": "Upload command failed",
    "exit_code": 1,
    "hint": "Please check that the file exists and is accessible."
  }
}
```

**原因例**:
- ファイルが存在しない
- 無効なアセットID
- ファイル形式が不正

#### 設定エラー（終了コード: 2）

```json
{
  "success": false,
  "error": {
    "message": "List command failed",
    "exit_code": 2,
    "hint": "Please run 'vidyeet login' to authenticate with Mux Video."
  }
}
```

**原因例**:
- 未ログイン状態
- 認証情報が無効
- 設定ファイルが破損

#### システムエラー（終了コード: 3）

```json
{
  "success": false,
  "error": {
    "message": "Upload command failed",
    "exit_code": 3,
    "hint": null
  }
}
```

**原因例**:
- ネットワーク接続エラー
- APIサーバーがダウン
- タイムアウト

---

## 設計上の注意事項

### 出力の一貫性

- 成功時・失敗時ともに**必ずJSON形式**で出力
- `success`フィールドで成功・失敗を判定可能
- 終了コードとJSONの両方でエラーを表現

### 標準入出力の使い分け

- **stdout**: JSON出力（結果・進捗）
- **stderr**: （--machine時は使用しない）
- **stdin**: 認証情報の入力（`login --stdin`）

### 進捗通知の設計

- **JSONL形式**（JSON Lines）: 1行1JSONで逐次処理可能
- 最終行に成功レスポンスが含まれる
- `--progress`フラグがない場合は進捗出力なし

### APIデータの完全性

- `--machine`モードでは、`list`と`show`コマンドが**Mux APIの完全なレスポンス**を返す
- 通常モードでは人間向けに簡略化されたデータのみ
- `resolution_tier`, `encoding_tier`, `tracks`などの詳細情報にアクセス可能

---

## バージョン互換性

### 現在のバージョン: 1.0

#### 保証される互換性

- JSON出力の基本構造（`success`, `command`フィールド）
- 終了コードの定義（0, 1, 2, 3）
- エラーレスポンスの構造

#### 将来追加される可能性のあるフィールド

- Mux APIの新機能に対応したフィールド
- 進捗フェーズの追加
- 統計情報フィールド

**推奨事項**: JSONパース時は、未知のフィールドを無視するように実装してください。

---

**関連ドキュメント**:
- [README.md](../README.md) - 一般ユーザー向けドキュメント
- [Mux API Documentation](https://docs.mux.com/api-reference) - Mux公式APIリファレンス

**サポート**:
- GitHub Issues: [https://github.com/k4zunoko/vidyeet-cli/issues](https://github.com/k4zunoko/vidyeet-cli/issues)
