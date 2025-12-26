# vidyeet-gui

Mux Video を操作する CLI（`bin/vidyeet-cli.exe`）をラップし、動画の一覧表示・プレビュー再生をGUIで行う Windows 専用デスクトップアプリです。
## 目的（現時点）

- 起動時に認証状態を確認（CLI: `--machine status`）
- 動画一覧を取得してサムネイル表示（CLI: `--machine list`）
- `playback_id` から GIF/サムネイル/HLS を生成してプレビュー

## ドキュメント
設計・実装方針は docs に集約しています。

- docs索引: `docs/README.md`
## 開発

前提:
- Windows
- Node.js

コマンド:
- `npm install`
- `npm run dev`

ビルド:
- `npm run build`

## CLI
利用可能なコマンドは以下で確認できます:

- `bin/vidyeet-cli.exe help`

GUI からは原則 `--machine` を付けて JSON を受け取ります。
