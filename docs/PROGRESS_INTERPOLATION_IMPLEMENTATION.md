# Progress Interpolation Implementation Summary

## 概要

CLI からの離散的な chunk 完了イベント（16MB 単位）を、滑らかな進捗表示に補間する機能を実装しました。

## 実装日

2025-12-25

## 問題

- CLI は chunk 完了（16MB 単位）でしか進捗を報告しない
- プログレスバーが離散的にジャンプし、UX が悪化
- ユーザーは「止まっている」と誤解する可能性

## 解決策

Truth（確定値）と Display（表示値）を分離し、推定補間により滑らかな進捗表示を実現。

### 設計原則（Nielsen Norman Group の研究に基づく）

1. **10秒以上の処理には percent-done indicator が必須**
2. **進捗表示があるとユーザーは3倍長く待てる**
3. **速度の変化はユーザーに気づかれ、満足度に影響する**

参照:
- https://www.nngroup.com/articles/progress-indicators/
- https://www.nngroup.com/articles/response-times-3-important-limits/

## 実装ファイル

### 新規作成

1. **`src/composables/useProgressInterpolation.ts`**
   - 補間ロジックのコンポーザブル
   - Truth/Display の分離
   - EMA + ease-out による滑らかな補間
   - 境界保護（次の chunk を超えない）

2. **`src/composables/README.md`**
   - composables の使用方法ドキュメント

### 変更

1. **`src/App.vue`**
   - `useProgressInterpolation` をインポート
   - `uploading_file` フェーズで補間を初期化
   - `uploading_chunk` フェーズで Truth を更新し、Display を表示
   - UI テキストに「（進捗表示は推定値）」を追加
   - CSS トランジションを 0.1s linear に変更（補間に最適化）

2. **`docs/UX_PSYCHOLOGY.md`**
   - 「進捗表示の補間」セクションを追加
   - Nielsen Norman Group の原則を整理
   - 実装方針と期待される UX 効果を記載

3. **`docs/ROADMAP.md`**
   - フェーズ2「進捗（percent）の表示強化」を実装済みにマーク
   - 実装詳細への参照を追加

4. **`docs/README.md`**
   - UX_PSYCHOLOGY.md の説明に進捗補間を追加

## アルゴリズム詳細

### 1. Truth と Display の分離

```
Truth: CLI が報告した確定済みバイト数（chunk 完了ベース）
Display: Truth を下限として、次の chunk 境界まで滑らかに補間
制約: truth ≤ display < next_chunk_boundary
```

### 2. 推定ロジック

1. **指数移動平均（EMA）で期待 chunk 所要時間を計算**
   ```
   EMA(t) = α * new_value + (1 - α) * prev_EMA
   α = 0.3（平滑化係数）
   ```

2. **現在 chunk 内での進捗率を計算**
   ```
   t = (now - last_chunk_time) / expected_duration
   t = clamp(t, 0.0, 1.0)
   ```

3. **Ease-out Cubic カーブを適用**
   ```
   easeOutCubic(t) = 1 - (1 - t)³
   ```
   - 最初は速く進み、後半で減速
   - chunk 境界での停止を視覚的に自然に見せる

4. **Display 値を計算**
   ```
   display = truth + (boundary - truth) * easedT * (1 - margin)
   margin = 1.5%（境界手前で停止するマージン）
   ```

5. **コールバックで UI に通知**
   - 補間タイマー（100ms ごと）が実行されるたびにコールバックを呼び出し
   - `onUpdate(displayBytes, displayPercent)` で UI を直接更新
   - Vue の reactivity system に依存せず、確実に UI が更新される

### 3. 安全性保証

- **境界保護**: Display は次の chunk 境界を超えない
- **タイムアウト**: 30 秒経過したら推定を停止
- **完了時の同期**: Truth が totalBytes に達したら Display も 100% に設定

## UI/UX の改善

### 視覚的改善

1. **滑らかなプログレスバー**
   - CSS トランジション: `width 0.1s linear`
   - 補間更新間隔: 100ms（10fps）
   - コールバックによるリアルタイム更新で chunk ジャンプが緩和され、連続的に見える

2. **境界での自然な停止**
   - Ease-out カーブにより、減速が視覚的に自然
   - ユーザーは「止まった」ではなく「もうすぐ次へ」と認識

3. **リアクティブ更新の課題を解決**
   - 当初は Vue の `watch` で補間値を監視する設計だったが、タイマーベースの更新が反映されない問題が発生
   - コールバックパターンに変更することで、補間タイマーが UI を確実に更新

### テキストでの明示

```
送信済み: 64.5MB / 512.0MB（注: UI の要件変更によりチャンク番号のテキスト表示（例: "3 / 10"）は画面に表示されません。プログレスは bytes ベースのパーセンテージを優先して算出され、`current_chunk` / `total_chunks` が提供される場合でも内部の補間ロジック（Warmup 等）のヒントとしてのみ利用されます。）
```

- **バー = 体感**、**テキスト = 事実** の役割分離
- 推定であることを明示し、誤解を防ぐ

## パフォーマンス

- **補間更新**: 100ms ごと（10fps）→ CPU 負荷は無視できるレベル
- **メモリ**: 数値とタイムスタンプのみ保持（軽量）
- **クリーンアップ**: コンポーネント unmount 時に自動的にタイマーを停止

## 期待される効果

1. **待ち時間の短縮感**: 動きがあることで認知リソースが分散
2. **誤解の防止**: 推定であることを明示し、信頼性を維持
3. **ユーザー満足度の向上**: 滑らかな動きにより、体感速度が向上
4. **3倍長く待てる**: Nielsen Norman Group の研究通り、進捗表示により待機許容時間が延長

## 今後の拡張可能性

### 可能な改善

1. **アダプティブな平滑化係数**
   - ネットワーク状況に応じて EMA の α を動的に調整
   - 安定した環境では大きく、不安定な環境では小さく

2. **予測精度の表示**
   - EMA の分散から信頼区間を計算
   - 「残り約 30 秒（±10 秒）」のような表示

3. **複数 chunk の先読み予測**
   - 過去数 chunk の傾向から、全体完了時刻を予測
   - より正確な「残り時間」表示

### 制約事項

- CLI からの進捗報告が不規則な場合、推定精度が低下
- 最初の chunk では履歴がないため、推定が機能しない
- 30 秒以上 CLI 応答がない場合、推定が停止

## 参照ドキュメント

- `src/composables/useProgressInterpolation.ts`: 実装本体
- `src/composables/README.md`: 使用方法
- `docs/UX_PSYCHOLOGY.md`: 設計原則と人間工学的背景
- `docs/ROADMAP.md`: 実装履歴

## テスト方法

### 手動テスト

1. 大きなファイル（100MB 以上）をアップロード
2. プログレスバーが滑らかに進むことを確認
3. chunk 境界で自然に減速・停止することを確認
4. 完了時に 100% になることを確認

### デバッグ

補間状態を確認する場合、`App.vue` のコールバック内のコメントを解除:

```typescript
// src/App.vue の useProgressInterpolation コールバック内
progressInterpolation = useProgressInterpolation(
    totalBytes,
    (displayBytes, displayPercent) => {
        // ...UI 更新...
        
        // デバッグログ（開発時のみ有効化）
        console.log(
            `[Progress Interpolation] Display: ${Math.round(displayBytes)}B (${Math.round(displayPercent)}%)`
        );
    },
);
```

これにより、100ms ごとに補間された値がコンソールに出力され、滑らかな動きを確認できます。

## まとめ

- **問題**: chunk 単位の離散的な進捗 → プログレスバーがジャンプ
- **解決**: Truth/Display 分離 + EMA + ease-out + コールバック → 滑らかな補間
- **キーポイント**: コールバックパターンで補間タイマーから直接 UI を更新
- **効果**: 待ち時間の短縮感、誤解の防止、ユーザー満足度向上
- **実装**: `src/composables/useProgressInterpolation.ts` + `src/App.vue`
- **根拠**: Nielsen Norman Group の研究に基づく人間工学的設計

### トラブルシューティング履歴

初回実装時、Vue の `watch` で補間値を監視する方法を試みたが、以下の問題が発生:
- 補間タイマーによる `ref` の更新が UI に反映されない
- `computed` の二重 `.value` アクセスによる型エラー

**解決策**: コールバックパターンに変更
- `useProgressInterpolation(totalBytes, onUpdate)` の第2引数にコールバックを渡す
- 補間タイマーが実行されるたびに `onUpdate(displayBytes, displayPercent)` を呼び出し
- コールバック内で直接 `uploadDialogState.value` を更新
- Vue の reactivity に依存せず、確実に UI が更新される