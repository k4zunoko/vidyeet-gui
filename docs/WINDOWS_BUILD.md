# Windows Build Guide

## 概要

vidyeet-gui は **Windows専用デスクトップアプリケーション** として設計されており、NSISインストーラーでパッケージングされます。

## ビルド環境

### 必須条件

- **OS**: Windows 10/11（推奨）
  - Linux/Mac でもビルド可能ですが、Windows上でのテストを推奨
- **Node.js**: v16以上
- **npm**: v8以上

### 依存パッケージ

```bash
npm install
```

必要な依存関係:
- `electron-builder`: インストーラー作成
- `vite`: フロントエンドビルド
- `vue-tsc`: TypeScriptコンパイル

## ビルドコマンド

### 開発ビルド（パッケージングなし）

```bash
npm run build:dir
```

- `release/${version}/win-unpacked/` に実行可能なアプリケーションが生成されます
- インストーラーは作成されません
- ビルド結果の動作確認に使用

### 本番ビルド（NSISインストーラー作成）

```bash
npm run build:win
```

または

```bash
npm run build
```

出力先: `release/${version}/Vidyeet-${version}-Setup.exe`

### ビルドプロセス

1. **TypeScriptコンパイル**: `vue-tsc`
2. **Viteビルド**: Renderer プロセス（Vue SPA）をバンドル → `dist/`
3. **Electron ビルド**: Main/Preload プロセスをバンドル → `dist-electron/`
4. **electron-builder**: NSIS インストーラーを作成 → `release/${version}/`

## NSISインストーラー設定

設定ファイル: `electron-builder.json5`

### 主要な設定項目

#### 基本情報

```json5
{
  "appId": "com.vidyeet.gui",
  "productName": "Vidyeet",
  "asar": true  // アプリケーションをASARアーカイブに圧縮
}
```

#### ファイル配置

```json5
{
  "files": ["dist", "dist-electron"],  // バンドル対象
  "extraResources": [
    {
      "from": "bin",  // CLI実行ファイルを同梱
      "to": "bin",
      "filter": ["**/*"]
    }
  ]
}
```

**重要**: `bin/vidyeet-cli.exe` はインストール後 `process.resourcesPath/bin/vidyeet-cli.exe` に配置されます。

#### Windows専用設定

```json5
{
  "win": {
    "target": [{
      "target": "nsis",
      "arch": ["x64"]  // 64bit版のみ
    }],
    "icon": "build/icon.ico",
    "publisherName": "vidyeet"
  }
}
```

#### NSISインストーラー詳細

| オプション | 値 | 説明 |
|----------|---|------|
| `oneClick` | `false` | ワンクリックインストール無効（カスタマイズ可能） |
| `allowToChangeInstallationDirectory` | `true` | インストール先フォルダを変更可能 |
| `perMachine` | `false` | ユーザーごとのインストール（管理者権限不要） |
| `allowElevation` | `true` | 必要時に管理者権限を要求可能 |
| `createDesktopShortcut` | `true` | デスクトップにショートカット作成 |
| `createStartMenuShortcut` | `true` | スタートメニューにショートカット作成 |
| `deleteAppDataOnUninstall` | `false` | アンインストール時にAppDataを削除しない |
| `runAfterFinish` | `true` | インストール完了後にアプリを起動 |

### AppData削除を無効にする理由

`deleteAppDataOnUninstall: false` により、アンインストール時に以下が保持されます:

- **CLI認証情報**: `vidyeet-cli.exe` が保存する認証トークン
- **ユーザー設定**: 将来追加される設定ファイル

再インストール時に再ログインが不要になります。

## アイコン設定

### 必要なファイル

- `build/icon.ico`: アプリケーション/インストーラー/アンインストーラーのアイコン

### アイコン要件

- **形式**: Windows Icon (.ico)
- **推奨サイズ**: 複数サイズを含む（16×16, 32×32, 48×48, 64×64, 128×128, 256×256）
- **色深度**: 32bit（アルファチャンネル対応）

### アイコンの作成

詳細は `build/README.md` を参照してください。

### アイコンが無い場合

electron-builder はデフォルトの Electron アイコンを使用します。製品リリース前に必ず設定してください。

## ビルド成果物

### ディレクトリ構造

```
release/
└── 0.0.0/  （バージョン番号）
    ├── Vidyeet-0.0.0-Setup.exe      ← NSISインストーラー
    ├── Vidyeet-0.0.0-Setup.exe.blockmap
    └── win-unpacked/                ← アンパック版（開発用）
        ├── Vidyeet.exe
        ├── resources/
        │   ├── app.asar             ← アプリケーション本体
        │   └── bin/
        │       └── vidyeet-cli.exe  ← CLI実行ファイル
        └── ...
```

### インストーラーの動作

1. **デフォルトインストール先**: `%LOCALAPPDATA%\Programs\Vidyeet`
2. **ショートカット作成**:
   - デスクトップ: `Vidyeet.lnk`
   - スタートメニュー: `Vidyeet\Vidyeet.lnk`
3. **アンインストーラー登録**: Windowsの「プログラムの追加と削除」に登録

## トラブルシューティング

### ビルドが失敗する

#### エラー: `icon.ico not found`

```bash
# build/icon.ico を配置するか、一時的に設定を無効化
# electron-builder.json5 から以下を削除:
# "icon": "build/icon.ico",
```

#### エラー: `ENOENT: no such file or directory, scandir 'bin'`

```bash
# bin/vidyeet-cli.exe が存在するか確認
ls bin/vidyeet-cli.exe
```

#### メモリ不足エラー

```bash
# Node.jsのメモリ制限を増やす
set NODE_OPTIONS=--max-old-space-size=4096
npm run build:win
```

### ビルドは成功するがインストーラーが動作しない

#### 症状: インストール完了後にアプリが起動しない

- `win-unpacked/Vidyeet.exe` を直接実行して動作確認
- イベントビューアー（Windows ログ > アプリケーション）でエラーを確認

#### 症状: `vidyeet-cli.exe` が見つからない

- インストール先の `resources/bin/vidyeet-cli.exe` が存在するか確認
- `electron/services/vidyeetClient.ts` でパス解決が正しいか確認

## 配布

### 配布物

- `release/${version}/Vidyeet-${version}-Setup.exe` を配布

### サイズ

- インストーラー: 約 80-150 MB（Electronランタイム + アプリケーション）
- インストール後: 約 200-300 MB

### システム要件（推奨）

- **OS**: Windows 10 (64bit) 以降
- **メモリ**: 4GB以上
- **ディスク空き容量**: 500MB以上

## セキュリティ

### コード署名

現在の設定では `verifyUpdateCodeSignature: false` によりコード署名を無効化しています。

製品リリース時には以下を検討してください:

1. **コード署名証明書の取得**: DigiCert、Sectigo等
2. **electron-builder.json5に追加**:

```json5
{
  "win": {
    "certificateFile": "path/to/cert.pfx",
    "certificatePassword": "${env.CERT_PASSWORD}",
    "signingHashAlgorithms": ["sha256"],
    "verifyUpdateCodeSignature": true
  }
}
```

### SmartScreen警告

署名なしのインストーラーは Windows SmartScreen で警告が表示されます:

- 「WindowsによってPCが保護されました」
- ユーザーは「詳細情報」→「実行」で回避可能

**コード署名を推奨します。**

## CI/CD統合

### GitHub Actions例

```yaml
name: Build Windows

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build:win
      - uses: actions/upload-artifact@v3
        with:
          name: windows-installer
          path: release/**/Vidyeet-*-Setup.exe
```

## 参考資料

- [electron-builder Documentation](https://www.electron.build/)
- [NSIS Options](https://www.electron.build/configuration/nsis)
- [Windows Code Signing](https://www.electron.build/code-signing#windows)
