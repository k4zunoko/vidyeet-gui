# コーディングエージェント向け情報

**MuxAPIをラップしたCLI（`bin/vidyeet-cli.exe`）を実行するWindows専用デスクトップアプリケーション**

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| **目的** | Muxへの動画アップロード・管理をGUIで安全・快適に行える |
| **技術スタック** | Vue 3 + Vite + Electron + TypeScript |
| **ターゲット環境** | Windows専用デスクトップアプリ |
| **CLI連携** | `bin/vidyeet-cli.exe` による Mux API の単一責務化 |

## ドキュメント索引

詳細な設計・実装指針は `docs/` に整理されています。

**最初に読むドキュメント** (推奨順序):
1. `docs/README.md` — プロジェクト最小概要・ナビゲーション・メタ情報
2. `docs/REQUIREMENTS.md` — 現実装の機能・非機能要求
3. `docs/CLI_CONTRACT.md` — CLI と GUI の責務分離・通信仕様
4. `docs/UX_PSYCHOLOGY.md` — UI 設計の心理学的原則と実装指針

その他の詳細ドキュメントは `docs/README.md` の「実装ガイド」セクションを参照してください。
