# Documentation Index

このフォルダは **vidyeet-gui** の設計・実装指針をまとめるドキュメント置き場です。
実装状況と常に一致させることで、開発の方針性と保守性を保ちます。

## プロジェクト最小概要

| 項目 | 詳細 |
|------|------|
| **目的** | Mux API をラップした CLI（`bin/vidyeet-cli.exe`）を安全・快適に利用するための Windows 専用デスクトップアプリケーション |
| **技術スタック** | Vue 3 + Vite + Electron + TypeScript（Renderer: Vue、IPC層: Preload、バックエンド: Main process + CLI） |
| **ターゲット環境** | Windows 専用（クロスプラットフォーム非対応） |
| **主要機能** | 認証・動画一覧表示・再生・削除・アップロード（複数ファイル逐次対応） |
| **ロール分担** | CLI が Mux API と認証情報を管理、GUI は UI/UX と進捗表示に集中 |

---

## クイックスタート（最初に読む）

本ドキュメント群の目的は LLM（コーディングエージェント）がプロジェクト状況を正確に理解することにあります。  
最初は以下の順序で読んでください：

1. **[DESIGN_PHILOSOPHY.md](./DESIGN_PHILOSOPHY.md)** — 設計原則・責務分離の全体方針
2. **[REQUIREMENTS.md](./REQUIREMENTS.md)** — 現実装の機能・非機能要求
3. **[UI_SPEC.md](./UI_SPEC.md)** — 画面仕様・状態遷移・ユーザー操作フロー

---

## 実装ガイド（設計と詳細）

### アーキテクチャ・インテグレーション

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** 
  - レイヤ構成（Renderer / Preload / Main / CLI）、責務分離、データフロー
  - 複数ファイルアップロードのキュー実装

- **[CLI_CONTRACT.md](./CLI_CONTRACT.md)** 
  - `bin/vidyeet-cli.exe` のコマンド・JSON スキーマ
  - 呼び出し約束と出力形式

- **[IPC_CONTRACT.md](./IPC_CONTRACT.md)** 
  - Electron IPC チャネル、メッセージ型、通信仕様

### エラー・品質

- **[ERROR_HANDLING.md](./ERROR_HANDLING.md)** 
  - エラー分類、ユーザー向け表示、ログ、再試行戦略

### 実装詳細（機能ごと）

- **[PROGRESS_INTERPOLATION_IMPLEMENTATION.md](./PROGRESS_INTERPOLATION_IMPLEMENTATION.md)** 
  - アップロード進捗を滑らかに表示する補間実装

- **[UPLOAD_QUEUE_IMPLEMENTATION.md](./UPLOAD_QUEUE_IMPLEMENTATION.md)** 
  - 複数ファイルアップロードのキュー管理実装（`useUploadQueue` composable）

### ビルド・デプロイ

- **[WINDOWS_BUILD.md](./WINDOWS_BUILD.md)** 
  - Windows ビルド手順、NSIS インストーラー設定

- **[RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)** 
  - リリース前のチェックリスト、ビルド手順

### デザイン・UX

- **[UX_PSYCHOLOGY.md](./UX_PSYCHOLOGY.md)** 
  - UI 設計の心理学的原則（進捗補間実装の根拠など）

### 将来の拡張

- **[ROADMAP.md](./ROADMAP.md)** 
  - 機能追加の優先順位と判断基準

---

## ドキュメント管理方針

**重要**: これらのドキュメントは実装状況と常に一致するよう、以下のタイミングで更新してください：

1. **設計判断の変更時**: DESIGN_PHILOSOPHY.md, 該当レイヤのドキュメント
2. **機能追加・仕様変更時**: REQUIREMENTS.md および UI_SPEC.md
3. **実装・データフロー変更時**: ARCHITECTURE.md、CLI_CONTRACT.md、IPC_CONTRACT.md
4. **エラー処理追加時**: ERROR_HANDLING.md
5. **ビルド設定変更時**: WINDOWS_BUILD.md

CodingAgent は常にこれらのドキュメントを参照してサポートを提供します。

---

## LLM向けメタ情報

### このドキュメント群について

**docs/配下のドキュメント群は、CodingAgent などの LLM 言語モデルがプロジェクト状況を正確に理解するために設計されています。**

### ドキュメント設計の責務

#### docs/README.md
- **プロジェクトの最低限の概要**（目的、技術スタック、アーキテクチャ）
- **docs/配下のドキュメントへのナビゲーション**（索引・使用ガイド）
- **このメタ情報**（LLM がドキュメント管理を理解するため）

#### docs/配下のドキュメント
- **詳細な設計方針と実装指針**（docs/README.md には書かない）
- **設計判断の根拠**（なぜこの設計にしたのか）
- **具体的な実装例とコードスニペット**
- **変更許容性のガイドライン**（何を変更してよいか、何を保護すべきか）
- **レイヤごとの責務と境界**

### ドキュメント品質の原則

1. **具体性**: 抽象的な記述ではなく、コード例や具体的な数値を含める
2. **根拠**: 設計判断には必ず理由を明記（パフォーマンス、保守性、安全性など）
3. **最新性**: 実装と常に一致させる（古い情報は削除または更新）
4. **ナビゲーション**: docs/README.md から各ドキュメントへの明確な案内
5. **文脈**: LLM が次回セッションで読んでも理解できる十分な文脈情報

### 注意事項

- **docs/README.md に詳細を書かない**: 詳細は docs/配下に分離
- **重複を避ける**: 同じ情報は 1 箇所のみに記載し、相互参照を使用
- **実装との一致**: ドキュメントと実装が乖離した場合、必ず同期する
- **docs/以外にドキュメントを増やさない**: docs/配下に集中
