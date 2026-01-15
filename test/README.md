# Test Directory

このディレクトリには、開発・デバッグ用のテストスクリプトとユーティリティが含まれています。

## 📁 ファイル一覧

### `mock-cli-upload.cjs`

**説明**: CLI の `upload --progress` コマンドの出力をシミュレートするモックスクリプト

**目的**:
- GUI側のアップロード進捗パース処理が正しく動作するかテストする
- 実際のCLIを実行せずにUI動作を確認する
- フラットなJSON構造（修正後の正しい形式）を出力する

**使用方法**:

```bash
# 基本的な使用方法
node test/mock-cli-upload.cjs <file-path>

# 例: source.mp4 をテスト
node test/mock-cli-upload.cjs source.mp4

# 例: 任意のファイルをテスト
node test/mock-cli-upload.cjs path/to/video.mp4
```

**出力例**:

```json
{"phase":"validating_file","file_path":"source.mp4"}
{"phase":"file_validated","file_name":"source.mp4","size_bytes":45495130,"format":"mp4"}
{"phase":"creating_direct_upload","file_name":"source.mp4"}
{"phase":"direct_upload_created","upload_id":"mock_abc123"}
{"phase":"uploading_file","file_name":"source.mp4","size_bytes":45495130}
{"phase":"uploading_chunk","current_chunk":1,"total_chunks":6,"bytes_sent":8388608,"total_bytes":45495130,"percent":18}
{"phase":"uploading_chunk","current_chunk":2,"total_chunks":6,"bytes_sent":16777216,"total_bytes":45495130,"percent":37}
...
{"phase":"upload_completed","file_name":"source.mp4","size_bytes":45495130}
{"phase":"waiting_for_asset","upload_id":"mock_abc123","elapsed_secs":1}
...
{"phase":"asset_created","asset_id":"mock_asset_xyz789"}
{"success":true,"asset_id":"mock_asset_xyz789"}
```

**動作フロー**:
1. `validating_file` - ファイルパス検証
2. `file_validated` - ファイル情報確認
3. `creating_direct_upload` - Direct Upload作成開始
4. `direct_upload_created` - アップロードURL取得
5. `uploading_file` - アップロード開始
6. `uploading_chunk` - チャンクごとの進捗（複数回）
7. `upload_completed` - アップロード完了
8. `waiting_for_asset` - アセット作成待機（複数回）
9. `asset_created` - アセット作成完了
10. 成功レスポンス

---

## 🧪 テスト方法

### 1. モックスクリプトの出力確認

```bash
# 出力をファイルに保存
node test/mock-cli-upload.cjs source.mp4 > test-output.txt

# 出力を整形表示
node test/mock-cli-upload.cjs source.mp4 | jq .
```

### 2. GUIとの統合テスト

GUIアプリケーション内で、実際のCLIの代わりにこのモックスクリプトを使用してテストすることも可能です。

**方法**:
1. `electron/services/vidyeetClient.ts` の `getCliPath()` を一時的に変更
2. `node` + `test/mock-cli-upload.cjs` を実行するように修正
3. GUI上でアップロード操作を実行
4. 進捗バーの表示を確認

**注意**: この変更はテスト用なので、コミットしないこと。

### 3. パース処理の単体テスト

```javascript
// electron/services/__tests__/vidyeetClient.test.ts (例)
import { spawn } from 'child_process';
import { upload } from '../vidyeetClient';

describe('upload() - JSON format', () => {
  it('should parse flat JSON structure correctly', async () => {
    // モックスクリプトを実行
    const result = await upload(
      { filePath: 'source.mp4' },
      (progress) => {
        console.log('Progress:', progress);
        // 各フィールドが正しくパースされているか確認
        expect(typeof progress.phase).toBe('string');
        if (progress.phase === 'uploading_chunk') {
          expect(progress.currentChunk).toBeGreaterThan(0);
          expect(progress.totalChunks).toBeGreaterThan(0);
        }
      }
    );
    
    expect(result.success).toBe(true);
  });
});
```

---

## 📝 関連ドキュメント

- [CLI契約仕様](../docs/CLI_CONTRACT.md) - CLIの出力形式の詳細
- [移行ガイド](../docs/migration/CLI_UPLOAD_PROGRESS_FORMAT.md) - JSON形式の修正について
- [IPC契約](../docs/IPC_CONTRACT.md) - Main ↔ Renderer 間のデータ型
- [UI仕様](../docs/UI_SPEC.md) - アップロード進捗バーの表示仕様

---

## 🔧 今後の追加予定

- [ ] モックエラーケース（ネットワークエラー、ファイルエラー等）
- [ ] CLIの他のコマンド（list, delete, login等）のモック
- [ ] 自動統合テストスクリプト
- [ ] パフォーマンステスト用のスクリプト

---

## 注意事項

- このディレクトリのスクリプトは開発・テスト用です
- 本番ビルドには含まれません
- モックスクリプトは実際のMux APIを呼び出しません
- 実際のアップロードをテストする場合は、本物の `bin/vidyeet-cli.exe` を使用してください