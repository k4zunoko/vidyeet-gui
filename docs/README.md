# docs/ Index

このフォルダは vidyeet-gui の設計・実装方針を「実装と常に一致」させるためのドキュメント置き場です。

## まず読む

- [DESIGN_PHILOSOPHY.md](./DESIGN_PHILOSOPHY.md): 設計原則・責務分離・全体方針
- [REQUIREMENTS.md](./REQUIREMENTS.md): 現スコープ（現実装）の要求仕様（機能/非機能）
- [UI_SPEC.md](./UI_SPEC.md): 画面・状態遷移・ユーザー操作

## UI/UX

- [UX_PSYCHOLOGY.md](./UX_PSYCHOLOGY.md): UI設計に使う心理学的原則の要約メモ（進捗表示の補間実装を含む）

## 実装時に参照

- [ARCHITECTURE.md](./ARCHITECTURE.md): レイヤ構成、データフロー、配置
- [CLI_CONTRACT.md](./CLI_CONTRACT.md): `vidyeet-cli.exe` 呼び出し・JSON契約・エッジケース
- [IPC_CONTRACT.md](./IPC_CONTRACT.md): Electron IPC のチャネルと型（Renderer←→Main）

## 品質

- [ERROR_HANDLING.md](./ERROR_HANDLING.md): エラー分類、UI表示、ログ、再試行
- [TESTING_STRATEGY.md](./TESTING_STRATEGY.md): テストの層（ユニット/統合）とモック方針

## 将来

- [ROADMAP.md](./ROADMAP.md): 機能追加の順序と判断基準（進捗補間は実装済み）

## 更新ルール

- 実装を変えたら、影響する doc も同じPRで更新する
- CLI の JSON 形状が変わったら、まず [CLI_CONTRACT.md](./CLI_CONTRACT.md) を更新する
- 画面増減があったら [UI_SPEC.md](./UI_SPEC.md) を更新する
