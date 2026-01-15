#!/usr/bin/env node

/**
 * Mock CLI Upload Script
 *
 * このスクリプトは、修正後のCLIの出力をシミュレートします。
 * GUI側のパース処理が正しく動作するかテストするために使用します。
 *
 * 使用方法:
 *   node test/mock-cli-upload.js <file-path>
 *
 * 出力形式: フラットなJSON構造（修正後の正しい形式）
 */

const fs = require('fs');
const path = require('path');

// コマンドライン引数をチェック
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(JSON.stringify({
    success: false,
    error: {
      exit_code: 1,
      message: "Usage: mock-cli-upload.js <file-path>"
    }
  }));
  process.exit(1);
}

const filePath = args[0];

// ファイルの存在確認
if (!fs.existsSync(filePath)) {
  console.error(JSON.stringify({
    success: false,
    error: {
      exit_code: 1,
      message: `File not found: ${filePath}`
    }
  }));
  process.exit(1);
}

// ファイル情報を取得
const stats = fs.statSync(filePath);
const fileName = path.basename(filePath);
const sizeBytes = stats.size;
const ext = path.extname(fileName).slice(1);

// アップロードシミュレーション
async function simulateUpload() {
  // 1. ファイル検証フェーズ
  console.log(JSON.stringify({
    phase: "validating_file",
    file_path: filePath
  }));
  await sleep(500);

  // 2. ファイル検証完了
  console.log(JSON.stringify({
    phase: "file_validated",
    file_name: fileName,
    size_bytes: sizeBytes,
    format: ext
  }));
  await sleep(300);

  // 3. Direct Upload 作成中
  console.log(JSON.stringify({
    phase: "creating_direct_upload",
    file_name: fileName
  }));
  await sleep(800);

  // 4. Direct Upload 作成完了
  const mockUploadId = "mock_" + Date.now().toString(36);
  console.log(JSON.stringify({
    phase: "direct_upload_created",
    upload_id: mockUploadId
  }));
  await sleep(300);

  // 5. ファイルアップロード開始
  console.log(JSON.stringify({
    phase: "uploading_file",
    file_name: fileName,
    size_bytes: sizeBytes
  }));
  await sleep(500);

  // 6. チャンクアップロード進捗（複数回）
  const chunkSize = 8 * 1024 * 1024; // 8MB
  const totalChunks = Math.ceil(sizeBytes / chunkSize);

  for (let i = 1; i <= totalChunks; i++) {
    const bytesSent = Math.min(i * chunkSize, sizeBytes);
    const percent = Math.round((bytesSent / sizeBytes) * 100);

    console.log(JSON.stringify({
      phase: "uploading_chunk",
      current_chunk: i,
      total_chunks: totalChunks,
      bytes_sent: bytesSent,
      total_bytes: sizeBytes,
      percent: percent
    }));

    // チャンクアップロードの間隔をシミュレート
    await sleep(200 + Math.random() * 300);
  }

  // 7. アップロード完了
  console.log(JSON.stringify({
    phase: "upload_completed",
    file_name: fileName,
    size_bytes: sizeBytes
  }));
  await sleep(500);

  // 8. アセット作成待機（複数回）
  for (let elapsed = 1; elapsed <= 5; elapsed++) {
    console.log(JSON.stringify({
      phase: "waiting_for_asset",
      upload_id: mockUploadId,
      elapsed_secs: elapsed
    }));
    await sleep(1000);
  }

  // 9. アセット作成完了
  const mockAssetId = "mock_asset_" + Date.now().toString(36);
  console.log(JSON.stringify({
    phase: "asset_created",
    asset_id: mockAssetId
  }));
  await sleep(300);

  // 10. 成功
  console.log(JSON.stringify({
    success: true,
    asset_id: mockAssetId
  }));
}

// ユーティリティ関数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  console.error(JSON.stringify({
    success: false,
    error: {
      exit_code: 1,
      message: error.message
    }
  }));
  process.exit(1);
});

// 実行
simulateUpload().catch((error) => {
  console.error(JSON.stringify({
    success: false,
    error: {
      exit_code: 1,
      message: error.message
    }
  }));
  process.exit(1);
});
