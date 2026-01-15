/**
 * Progress Interpolation Composable
 *
 * CLI からの離散的な chunk 完了イベントを、滑らかな進捗表示に補間する。
 *
 * ## 設計原則（人間工学的アプローチ）
 *
 * ### Nielsen Norman Group の研究に基づく UX 原則:
 * - 10秒以上の処理には percent-done indicator が必須
 * - 進捗表示があるとユーザーは3倍長く待てる
 * - 速度の変化はユーザーに気づかれ、満足度に影響する
 *
 * ### Truth（確定値）と Display（表示値）の分離:
 * - Truth: CLI が報告した確定済み bytes（chunk 完了ベース）
 * - Display: Truth を下限として、次の chunk 境界まで滑らかに補間
 * - 制約: truth ≤ display < next_chunk_boundary（境界を超えない）
 *
 * ### 推定ロジック:
 * 1. 直近の chunk 所要時間から期待時間 E を計算（指数移動平均）
 * 2. 現在の chunk 内での進捗を ease-out カーブで推定
 * 3. 境界手前で自然に減速・停止（margin を残す）
 * 4. CLI 更新が遅延した場合は推定を停止
 *
 * @see docs/UX_PSYCHOLOGY.md
 * @see https://www.nngroup.com/articles/progress-indicators/
 * @see https://www.nngroup.com/articles/response-times-3-important-limits/
 */

import { ref, computed, onUnmounted } from "vue";

/**
 * Ease-out cubic function
 * 最初は速く、後半で減速して滑らかに停止
 *
 * @param t - 進捗（0.0 ~ 1.0）
 * @returns イージング適用後の値（0.0 ~ 1.0）
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * 指数移動平均（EMA）の計算
 *
 * @param prevEma - 前回の EMA 値
 * @param newValue - 新しいサンプル値
 * @param alpha - 平滑化係数（0.0 ~ 1.0）大きいほど新しい値に反応
 * @returns 新しい EMA 値
 */
function calculateEma(
  prevEma: number | null,
  newValue: number,
  alpha: number,
): number {
  if (prevEma === null) {
    return newValue;
  }
  return alpha * newValue + (1 - alpha) * prevEma;
}

/**
 * Chunk アップロード進捗の補間状態
 */
interface InterpolationState {
  /** 確定済みバイト数（Truth） */
  truthBytes: number;
  /** 表示用バイト数（Display、補間済み） */
  displayBytes: number;
  /** 表示用パーセンテージ */
  displayPercent: number;
  /** 推定が有効かどうか */
  isInterpolating: boolean;
}

/**
 * Progress Interpolation Composable
 *
 * @param totalBytes - アップロード総バイト数
 * @param chunkSize - chunk サイズ（デフォルト 16MB = 16777216 bytes）
 * @returns 補間状態と更新関数
 */
export function useProgressInterpolation(
  totalBytes: number,
  onUpdate?: (displayBytes: number, displayPercent: number) => void,
  chunkSize: number = 16777216, // 16MB
) {
  // ==========================================================================
  // 内部状態
  // ==========================================================================

  /** 確定済みバイト数（CLI から報告された Truth） */
  const truthBytes = ref(0);

  /** 表示用バイト数（補間済み Display） */
  const displayBytes = ref(0);

  /** 最後に chunk 完了が報告された時刻 */
  const lastChunkTime = ref<number | null>(null);

  /** chunk あたりの期待所要時間（ミリ秒、EMA で計算） */
  const expectedChunkDuration = ref<number | null>(null);

  /** 補間タイマー ID */
  let interpolationTimer: number | null = null;

  /** 推定が停止するまでの最大待機時間（ミリ秒） */
  const MAX_INTERPOLATION_TIME = 30000; // 30秒

  /** EMA の平滑化係数（0.0 ~ 1.0、大きいほど新しい値に反応） */
  const EMA_ALPHA = 0.3;

  /** 境界手前で停止するマージン（パーセンテージ、0.01 = 1%） */
  const BOUNDARY_MARGIN = 0.015; // 1.5%

  /** 補間更新の間隔（ミリ秒） */
  const INTERPOLATION_INTERVAL = 100; // 100ms = 10fps

  // ==========================================================================
  // Computed Properties
  // ==========================================================================

  /** 表示用パーセンテージ（0 ~ 100） */
  const displayPercent = computed(() => {
    if (totalBytes === 0) return 0;
    return Math.min(100, (displayBytes.value / totalBytes) * 100);
  });

  /** 次の chunk 境界バイト数 */
  const nextChunkBoundary = computed(() => {
    const currentChunk = Math.floor(truthBytes.value / chunkSize);
    return Math.min((currentChunk + 1) * chunkSize, totalBytes);
  });

  /** 推定が有効かどうか */
  const isInterpolating = computed(() => {
    return (
      interpolationTimer !== null &&
      truthBytes.value < totalBytes &&
      expectedChunkDuration.value !== null
    );
  });

  // ==========================================================================
  // 補間ロジック
  // ==========================================================================

  /**
   * 補間を更新する（タイマーから呼ばれる）
   */
  function updateInterpolation() {
    if (lastChunkTime.value === null || expectedChunkDuration.value === null) {
      return;
    }

    const now = Date.now();
    const elapsed = now - lastChunkTime.value;

    // 最大待機時間を超えたら推定を停止
    if (elapsed > MAX_INTERPOLATION_TIME) {
      stopInterpolation();
      return;
    }

    // 期待所要時間内での進捗率（0.0 ~ 1.0+）
    const t = Math.min(1.0, elapsed / (expectedChunkDuration.value || 1000));

    // Ease-out カーブを適用
    const easedT = easeOutCubic(t);

    // 次の chunk 境界までの距離
    const boundary = nextChunkBoundary.value;
    const rangeBytes = boundary - truthBytes.value;

    // マージンを考慮して境界手前で停止
    const marginBytes = totalBytes * BOUNDARY_MARGIN;
    const maxProgress = boundary - marginBytes;

    // 表示値を更新（truth ≤ display < boundary - margin）
    const interpolatedBytes =
      truthBytes.value + rangeBytes * easedT * (1 - BOUNDARY_MARGIN);
    displayBytes.value = Math.min(
      maxProgress,
      Math.max(truthBytes.value, interpolatedBytes),
    );

    // コールバックで UI に通知
    if (onUpdate) {
      const percent =
        totalBytes === 0
          ? 0
          : Math.min(100, (displayBytes.value / totalBytes) * 100);
      onUpdate(displayBytes.value, percent);
    }
  }

  /**
   * 補間タイマーを開始
   */
  function startInterpolation() {
    if (interpolationTimer !== null) {
      return;
    }

    interpolationTimer = window.setInterval(() => {
      updateInterpolation();
    }, INTERPOLATION_INTERVAL);
  }

  /**
   * 補間タイマーを停止
   */
  function stopInterpolation() {
    if (interpolationTimer !== null) {
      clearInterval(interpolationTimer);
      interpolationTimer = null;
    }
  }

  // ==========================================================================
  // 公開 API
  // ==========================================================================

  /**
   * Truth（確定値）を更新
   *
   * CLI から chunk 完了が報告された時に呼ぶ
   *
   * @param bytes - 確定済みバイト数
   */
  function updateTruth(bytes: number) {
    const now = Date.now();

    // chunk 所要時間を計算（EMA で平滑化）
    if (lastChunkTime.value !== null && bytes > truthBytes.value) {
      const chunkDuration = now - lastChunkTime.value;
      expectedChunkDuration.value = calculateEma(
        expectedChunkDuration.value,
        chunkDuration,
        EMA_ALPHA,
      );
    }

    // Truth を更新
    truthBytes.value = bytes;

    // Display が Truth より小さい場合は即座に同期
    if (displayBytes.value < bytes) {
      displayBytes.value = bytes;
    }

    // タイムスタンプを更新
    lastChunkTime.value = now;

    // 完了していない場合は補間を開始
    if (bytes < totalBytes) {
      startInterpolation();
    } else {
      // 完了時は補間を停止し、100% に設定
      stopInterpolation();
      displayBytes.value = totalBytes;
      if (onUpdate) {
        onUpdate(totalBytes, 100);
      }
    }

    // 即座に UI を更新（CLI イベント時）
    if (onUpdate) {
      const percent =
        totalBytes === 0
          ? 0
          : Math.min(100, (displayBytes.value / totalBytes) * 100);
      onUpdate(displayBytes.value, percent);
    }
  }

  /**
   * リセット（新しいアップロード開始時）
   */
  function reset() {
    stopInterpolation();
    truthBytes.value = 0;
    displayBytes.value = 0;
    lastChunkTime.value = null;
    expectedChunkDuration.value = null;
  }

  /**
   * 状態を取得
   */
  function getState(): InterpolationState {
    return {
      truthBytes: truthBytes.value,
      displayBytes: displayBytes.value,
      displayPercent: displayPercent.value,
      isInterpolating: isInterpolating.value,
    };
  }

  // ==========================================================================
  // クリーンアップ
  // ==========================================================================

  onUnmounted(() => {
    stopInterpolation();
  });

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    /** 確定済みバイト数（Truth、読み取り専用） */
    truthBytes: computed(() => truthBytes.value),

    /** 表示用バイト数（Display、読み取り専用、リアクティブ） */
    displayBytes: computed(() => displayBytes.value),

    /** 表示用パーセンテージ（0 ~ 100、読み取り専用、リアクティブ） */
    displayPercent,

    /** 推定が有効かどうか（読み取り専用） */
    isInterpolating,

    /** Truth を更新 */
    updateTruth,

    /** リセット */
    reset,

    /** 状態を取得（非推奨: リアクティブなプロパティを直接使用してください） */
    getState,
  };
}
