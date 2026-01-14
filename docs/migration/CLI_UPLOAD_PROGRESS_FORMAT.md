# CLI Upload Progress JSON Format Migration Guide

## 概要

CLIの`upload --progress`コマンドにおいて、進捗情報のJSON出力形式に不要なネストが存在するバグが発見されました。このドキュメントでは、バグ修正に伴うGUI側の変更箇所と修正方針をまとめます。

---

## 問題の詳細

### 現在の実装（バグあり）

CLIは進捗情報を以下の形式で出力しています：

```json
{"phase":{"phase":"validating_file","file_path":"source.mp4"}}
{"phase":{"phase":"file_validated","file_name":"source.mp4","size_bytes":45495130,"format":"mp4"}}
{"phase":{"phase":"creating_direct_upload","file_name":"source.mp4"}}
{"phase":{"phase":"direct_upload_created","upload_id":"FuGRedrmHznuPb00FimCM7jmffOE9orKSWZTq015NNfvw"}}
{"phase":{"phase":"uploading_file","file_name":"source.mp4","size_bytes":45495130}}
{"phase":{"phase":"uploading_chunk","current_chunk":1,"total_chunks":10,"bytes_sent":1048576,"total_bytes":10485760}}
```

**問題点**: `phase`フィールドが不要に二重ネストされている

### 期待される形式（修正後）

マニュアル（`bin/MACHINE_API.md`）に記載されている通り、以下の形式が正しいです：

```json
{"phase":"validating_file","file_path":"source.mp4"}
{"phase":"file_validated","file_name":"source.mp4","size_bytes":45495130,"format":"mp4"}
{"phase":"creating_direct_upload","file_name":"source.mp4"}
{"phase":"direct_upload_created","upload_id":"FuGRedrmHznuPb00FimCM7jmffOE9orKSWZTq015NNfvw"}
{"phase":"uploading_file","file_name":"source.mp4","size_bytes":45495130}
{"phase":"uploading_chunk","current_chunk":1,"total_chunks":10,"bytes_sent":1048576,"total_bytes":10485760}
```

**修正内容**: `phase`はトップレベルのフィールドで、その値は文字列（フェーズ名）

---

## 影響範囲の分析

### 1. `electron/services/vidyeetClient.ts` - `upload()` 関数

**ファイルパス**: `vidyeet-gui/electron/services/vidyeetClient.ts`

**現在の実装** (L314-333):

```typescript
const json = JSON.parse(line);

// 進捗通知
if (json.phase && onProgress) {
  const p = json.phase;  // ← ネストされたオブジェクトを取得
  onProgress({
    phase: p.phase as UploadProgress["phase"],  // ← さらにネストを辿る
    fileName: p.file_name,
    sizeBytes: p.size_bytes,
    format: p.format,
    uploadId: p.upload_id,
    percent: p.percent,
    currentChunk: p.current_chunk,
    totalChunks: p.total_chunks,
    bytesSent: p.bytes_sent,
    totalBytes: p.total_bytes,
    elapsedSecs: p.elapsed_secs,
  });
}
```

**修正後の実装**:

```typescript
const json = JSON.parse(line);

// 進捗通知
// phase が文字列の場合（修正後のフォーマット）
if (typeof json.phase === "string" && onProgress) {
  onProgress({
    phase: json.phase as UploadProgress["phase"],
    fileName: json.file_name,
    sizeBytes: json.size_bytes,
    format: json.format,
    uploadId: json.upload_id,
    percent: json.percent,
    currentChunk: json.current_chunk,
    totalChunks: json.total_chunks,
    bytesSent: json.bytes_sent,
    totalBytes: json.total_bytes,
    elapsedSecs: json.elapsed_secs,
  });
}
```

### 2. その他のCLIコマンド出力の確認

念のため、他のコマンド（`status`, `login`, `list`, `delete`）の出力形式も確認しましたが、これらは正しい形式で出力されており、問題ありません。

**確認済み**:
- `status`: `{"success":true,"is_authenticated":true,"token_id":"..."}`
- `login`: `{"command":"login","success":true}`
- `list`: `{"success":true,"data":[...]}`
- `delete`: `{"command":"delete","success":true}`

**結論**: `upload --progress`の進捗出力のみがバグの影響を受けています。

---

## 修正方針

### オプション1: 完全移行（推奨）

CLIのバグ修正と同時に、GUI側も新フォーマットに完全移行する。

**メリット**:
- コードがシンプルになる
- 仕様書との一貫性が保たれる

**デメリット**:
- 古いCLIバージョンとの互換性がない

**推奨理由**:
- CLIとGUIは同一リポジトリで管理されている
- バージョン管理が一体化しているため、互換性維持の必要性が低い
- 現時点でリリース前のため、ユーザーへの影響がない

### オプション2: 後方互換性維持

古いフォーマット（ネスト）と新しいフォーマット（フラット）の両方をサポートする。

**メリット**:
- 段階的な移行が可能
- 古いCLIでも動作する

**デメリット**:
- コードが複雑になる
- テストケースが増える
- 将来的に古いフォーマットのサポートを削除する必要がある

**実装例**:

```typescript
const json = JSON.parse(line);

// 進捗通知（両フォーマット対応）
if (json.phase && onProgress) {
  // 新フォーマット: json.phase が文字列
  if (typeof json.phase === "string") {
    onProgress({
      phase: json.phase as UploadProgress["phase"],
      fileName: json.file_name,
      sizeBytes: json.size_bytes,
      format: json.format,
      uploadId: json.upload_id,
      percent: json.percent,
      currentChunk: json.current_chunk,
      totalChunks: json.total_chunks,
      bytesSent: json.bytes_sent,
      totalBytes: json.total_bytes,
      elapsedSecs: json.elapsed_secs,
    });
  }
  // 旧フォーマット: json.phase がオブジェクト（バグあり）
  else if (typeof json.phase === "object" && json.phase !== null) {
    const p = json.phase;
    onProgress({
      phase: p.phase as UploadProgress["phase"],
      fileName: p.file_name,
      sizeBytes: p.size_bytes,
      format: p.format,
      uploadId: p.upload_id,
      percent: p.percent,
      currentChunk: p.current_chunk,
      totalChunks: p.total_chunks,
      bytesSent: p.bytes_sent,
      totalBytes: p.total_bytes,
      elapsedSecs: p.elapsed_secs,
    });
  }
}
```

---

## 推奨される修正手順

### ステップ1: CLIのバグ修正

CLIの実装を修正し、進捗情報を正しいフォーマットで出力する。

**修正箇所（CLIリポジトリ）**:
- 進捗情報の出力部分で、`phase`オブジェクトを不要にネストしないように修正

### ステップ2: GUI側の修正

`vidyeet-gui/electron/services/vidyeetClient.ts`の`upload()`関数を修正。

**推奨**: オプション1（完全移行）

### ステップ3: ドキュメントの更新

- `docs/CLI_CONTRACT.md`: 進捗フォーマットの説明が既に正しい形式になっているため、変更不要
- `bin/MACHINE_API.md`: 既に正しい形式が記載されているため、変更不要

### ステップ4: テスト

1. **ユニットテスト**: モックデータで新フォーマットをテスト
2. **統合テスト**: 実際のCLI実行で進捗表示が正しく動作するか確認
3. **エッジケース**: JSONパースエラー、不正なフォーマットのハンドリング

---

## テスト方法

### 手動テスト

1. CLIを修正後、実際に動画をアップロードする
2. 進捗ダイアログでプログレスバーが正しく表示されることを確認
3. 各フェーズのテキストが正しく更新されることを確認

### 検証用のモックデータ

**新フォーマット**（修正後）:

```json
{"phase":"validating_file","file_path":"test.mp4"}
{"phase":"file_validated","file_name":"test.mp4","size_bytes":10485760,"format":"mp4"}
{"phase":"creating_direct_upload","file_name":"test.mp4"}
{"phase":"direct_upload_created","upload_id":"abc123"}
{"phase":"uploading_file","file_name":"test.mp4","size_bytes":10485760}
{"phase":"uploading_chunk","current_chunk":1,"total_chunks":10,"bytes_sent":1048576,"total_bytes":10485760}
{"phase":"uploading_chunk","current_chunk":5,"total_chunks":10,"bytes_sent":5242880,"total_bytes":10485760}
{"phase":"uploading_chunk","current_chunk":10,"total_chunks":10,"bytes_sent":10485760,"total_bytes":10485760}
{"phase":"file_uploaded","file_name":"test.mp4","size_bytes":10485760}
{"phase":"waiting_for_asset","upload_id":"abc123","elapsed_secs":2}
{"phase":"completed","asset_id":"abc123xyz"}
{"success":true,"asset_id":"abc123xyz"}
```

---

## 変更が必要なファイル一覧

| ファイルパス | 変更内容 | 優先度 |
|-------------|---------|-------|
| `electron/services/vidyeetClient.ts` | `upload()`関数のJSONパース処理を修正 | 🔴 必須 |

**変更不要なファイル**:
- `electron/types/ipc.ts`: 型定義は正しい（`UploadProgress`インターフェース）
- `electron/services/cliRunner.ts`: 汎用的なJSON処理のため影響なし
- `src/App.vue`: 受け取る側なので影響なし
- `docs/CLI_CONTRACT.md`: 既に正しいフォーマットが記載されている
- `docs/UI_SPEC.md`: CLI出力形式に依存しない

---

## リスク評価

| リスク | 影響度 | 対策 |
|-------|-------|------|
| 古いCLIとの互換性喪失 | 低 | CLIとGUIは同時にリリースされる |
| パースエラーによる進捗表示の失敗 | 中 | try-catchで既にエラーハンドリングされている |
| プログレスバーが表示されない | 中 | 手動テストで確認 |

---

## まとめ

**推奨アクション**:
1. CLIのバグを修正し、`phase`のネストを削除
2. GUI側の`vidyeetClient.ts`を修正（完全移行）
3. 手動テストでプログレスバーの動作を確認

**修正の容易性**: 🟢 簡単（1ファイルの1箇所のみ修正）

**影響範囲**: 🟢 限定的（`upload`コマンドの進捗処理のみ）

**テスト**: 🟡 中程度（手動テストが必要）

---

## 詳細: コード変更の差分

### 変更箇所の詳細比較

**ファイル**: `vidyeet-gui/electron/services/vidyeetClient.ts`
**関数**: `upload()`
**行番号**: L314-333 (現在の実装)

#### 変更前（現在のコード）

```typescript
child.stdout.on("data", (data: Buffer) => {
  const text = data.toString();
  stdout += text;

  // 改行区切りでJSONを処理
  const lines = text.split("\n").filter((line) => line.trim());
  for (const line of lines) {
    try {
      const json = JSON.parse(line);

      // 進捗通知
      if (json.phase && onProgress) {
        const p = json.phase;  // ← 問題: ネストされたオブジェクトを取得
        onProgress({
          phase: p.phase as UploadProgress["phase"],  // ← 問題: さらにネストを辿る
          fileName: p.file_name,
          sizeBytes: p.size_bytes,
          format: p.format,
          uploadId: p.upload_id,
          percent: p.percent,
          currentChunk: p.current_chunk,
          totalChunks: p.total_chunks,
          bytesSent: p.bytes_sent,
          totalBytes: p.total_bytes,
          elapsedSecs: p.elapsed_secs,
        });
      }

      // 成功完了
      if (json.success === true && json.asset_id) {
        resolve({
          success: true,
          assetId: json.asset_id,
        });
      }

      // エラー完了
      if (json.success === false && json.error) {
        resolve({
          code: "CLI_NON_ZERO_EXIT",
          message: json.error.message || "アップロードに失敗しました",
          details: json.error,
        });
      }
    } catch {
      // JSONパース失敗は無視（部分的なデータの可能性）
    }
  }
});
```

#### 変更後（修正版）

```typescript
child.stdout.on("data", (data: Buffer) => {
  const text = data.toString();
  stdout += text;

  // 改行区切りでJSONを処理
  const lines = text.split("\n").filter((line) => line.trim());
  for (const line of lines) {
    try {
      const json = JSON.parse(line);

      // 進捗通知
      // 修正: phase が文字列の場合（正しいフォーマット）
      if (typeof json.phase === "string" && onProgress) {
        onProgress({
          phase: json.phase as UploadProgress["phase"],
          fileName: json.file_name,      // ← 修正: トップレベルから直接取得
          sizeBytes: json.size_bytes,    // ← 修正: トップレベルから直接取得
          format: json.format,           // ← 修正: トップレベルから直接取得
          uploadId: json.upload_id,      // ← 修正: トップレベルから直接取得
          percent: json.percent,         // ← 修正: トップレベルから直接取得
          currentChunk: json.current_chunk,    // ← 修正: トップレベルから直接取得
          totalChunks: json.total_chunks,      // ← 修正: トップレベルから直接取得
          bytesSent: json.bytes_sent,          // ← 修正: トップレベルから直接取得
          totalBytes: json.total_bytes,        // ← 修正: トップレベルから直接取得
          elapsedSecs: json.elapsed_secs,      // ← 修正: トップレベルから直接取得
        });
      }

      // 成功完了
      if (json.success === true && json.asset_id) {
        resolve({
          success: true,
          assetId: json.asset_id,
        });
      }

      // エラー完了
      if (json.success === false && json.error) {
        resolve({
          code: "CLI_NON_ZERO_EXIT",
          message: json.error.message || "アップロードに失敗しました",
          details: json.error,
        });
      }
    } catch {
      // JSONパース失敗は無視（部分的なデータの可能性）
    }
  }
});
```

### 変更のポイント

1. **条件チェックの変更**: `if (json.phase && onProgress)` → `if (typeof json.phase === "string" && onProgress)`
2. **中間変数の削除**: `const p = json.phase;` を削除
3. **フィールドアクセスの変更**: `p.phase` → `json.phase`, `p.file_name` → `json.file_name` など

---

## テストコード例

### ユニットテスト（モックデータ）

```typescript
// test/services/vidyeetClient.test.ts
import { describe, it, expect, vi } from 'vitest';
import { upload } from '../../electron/services/vidyeetClient';

describe('upload() - JSON format migration', () => {
  it('should parse new format (flat structure) correctly', async () => {
    const progressCallback = vi.fn();
    
    // 新フォーマットのモックデータ
    const mockOutput = [
      '{"phase":"validating_file","file_path":"test.mp4"}',
      '{"phase":"uploading_chunk","current_chunk":1,"total_chunks":10,"bytes_sent":1048576,"total_bytes":10485760}',
      '{"success":true,"asset_id":"abc123"}',
    ].join('\n');

    // spawn をモック
    vi.mock('child_process', () => ({
      spawn: vi.fn(() => ({
        stdout: {
          on: vi.fn((event, handler) => {
            if (event === 'data') {
              handler(Buffer.from(mockOutput));
            }
          }),
        },
        stderr: { on: vi.fn() },
        stdin: { end: vi.fn() },
        on: vi.fn((event, handler) => {
          if (event === 'close') {
            handler(0);
          }
        }),
      })),
    }));

    await upload({ filePath: 'test.mp4' }, progressCallback);

    // 進捗コールバックが正しく呼ばれたことを確認
    expect(progressCallback).toHaveBeenCalledWith({
      phase: 'validating_file',
      fileName: undefined,
      sizeBytes: undefined,
      format: undefined,
      uploadId: undefined,
      percent: undefined,
      currentChunk: undefined,
      totalChunks: undefined,
      bytesSent: undefined,
      totalBytes: undefined,
      elapsedSecs: undefined,
    });

    expect(progressCallback).toHaveBeenCalledWith({
      phase: 'uploading_chunk',
      fileName: undefined,
      sizeBytes: undefined,
      format: undefined,
      uploadId: undefined,
      percent: undefined,
      currentChunk: 1,
      totalChunks: 10,
      bytesSent: 1048576,
      totalBytes: 10485760,
      elapsedSecs: undefined,
    });
  });
});
```

### 統合テスト（実際のCLI実行）

```typescript
// test/integration/upload.test.ts
import { describe, it, expect } from 'vitest';
import { upload } from '../../electron/services/vidyeetClient';
import path from 'path';

describe('upload() - Integration test with real CLI', () => {
  it('should upload a file and report progress correctly', async () => {
    const testFilePath = path.join(__dirname, 'fixtures', 'test-video.mp4');
    const progressEvents: any[] = [];

    const result = await upload(
      { filePath: testFilePath },
      (progress) => {
        progressEvents.push(progress);
      }
    );

    // 成功確認
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('assetId');

    // 進捗イベントの確認
    expect(progressEvents.length).toBeGreaterThan(0);
    
    // uploading_chunk イベントがあることを確認
    const chunkEvents = progressEvents.filter(e => e.phase === 'uploading_chunk');
    expect(chunkEvents.length).toBeGreaterThan(0);
    
    // uploading_chunk イベントのフィールドを確認
    const firstChunk = chunkEvents[0];
    expect(firstChunk).toHaveProperty('currentChunk');
    expect(firstChunk).toHaveProperty('totalChunks');
    expect(firstChunk).toHaveProperty('bytesSent');
    expect(firstChunk).toHaveProperty('totalBytes');
    expect(firstChunk.bytesSent).toBeGreaterThan(0);
    expect(firstChunk.totalBytes).toBeGreaterThan(0);
  });
});
```

### 手動テスト用スクリプト

```bash
#!/bin/bash
# test/manual/test-upload-progress.sh

# CLIの新フォーマット出力をシミュレート
echo '{"phase":"validating_file","file_path":"test.mp4"}'
echo '{"phase":"file_validated","file_name":"test.mp4","size_bytes":10485760,"format":"mp4"}'
echo '{"phase":"creating_direct_upload","file_name":"test.mp4"}'
echo '{"phase":"direct_upload_created","upload_id":"abc123"}'
echo '{"phase":"uploading_file","file_name":"test.mp4","size_bytes":10485760}'
echo '{"phase":"uploading_chunk","current_chunk":1,"total_chunks":10,"bytes_sent":1048576,"total_bytes":10485760}'
echo '{"phase":"uploading_chunk","current_chunk":5,"total_chunks":10,"bytes_sent":5242880,"total_bytes":10485760}'
echo '{"phase":"uploading_chunk","current_chunk":10,"total_chunks":10,"bytes_sent":10485760,"total_bytes":10485760}'
echo '{"phase":"file_uploaded","file_name":"test.mp4","size_bytes":10485760}'
echo '{"phase":"waiting_for_asset","upload_id":"abc123","elapsed_secs":2}'
echo '{"phase":"completed","asset_id":"abc123xyz"}'
echo '{"success":true,"asset_id":"abc123xyz"}'
```

---

## チェックリスト

修正完了時に以下を確認してください：

- [ ] CLIのバグ修正が完了している
- [ ] `vidyeetClient.ts`の`upload()`関数を修正した
- [ ] 手動テストで実際の動画アップロードが成功する
- [ ] プログレスバーが正しく表示される（0% → 100%）
- [ ] パーセンテージとバイト数が正しく更新される
- [ ] チャンク進捗（例: "3/10 チャンク"）が正しく表示される
- [ ] 完了時に成功メッセージとトースト通知が表示される
- [ ] エラー時に適切なエラーメッセージが表示される
- [ ] JSONパースエラーが発生しない
- [ ] 不正なフォーマットのデータが来てもクラッシュしない

---

## よくある質問（FAQ）

### Q1: 後方互換性は本当に不要ですか？

A: はい、以下の理由から不要と判断しています：
- CLIとGUIは同一リポジトリで管理されている
- 同時にビルド・リリースされる
- まだ本番環境にリリースされていない（開発段階）

### Q2: 修正後も古いCLIで動作させたい場合は？

A: オプション2（後方互換性維持）を採用してください。ただし、コードが複雑になり、テストケースも増えるため推奨しません。

### Q3: 他のコマンドも同じようなバグがある可能性は？

A: 調査した結果、`upload --progress`のみがこのバグの影響を受けています。他のコマンド（`status`, `login`, `list`, `delete`）は正しい形式で出力されています。

### Q4: JSONパースエラーが発生した場合はどうなりますか？

A: 現在の実装では`try-catch`で囲まれており、パースエラーは無視されます（部分的なデータの可能性があるため）。修正後もこの挙動は変わりません。

### Q5: テストコードは必要ですか？

A: ユニットテストの追加を推奨しますが、最低限、手動テストで実際のアップロードが成功することを確認してください。