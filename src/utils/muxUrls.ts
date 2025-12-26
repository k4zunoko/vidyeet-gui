/**
 * Mux URL生成ユーティリティ
 *
 * playback_id から各種URLを生成する
 * @see docs/CLI_CONTRACT.md - URL 生成（Mux）
 */

/** Mux Image CDN のベースURL */
const MUX_IMAGE_BASE = 'https://image.mux.com';

/** Mux Stream CDN のベースURL */
const MUX_STREAM_BASE = 'https://stream.mux.com';

/** デフォルトのサムネイル幅 */
const DEFAULT_THUMBNAIL_WIDTH = 180;

/** デフォルトのGIF幅 */
const DEFAULT_GIF_WIDTH = 180;

/**
 * サムネイルURLを生成
 */
export function getThumbnailUrl(
  playbackId: string,
  options?: { width?: number; format?: 'jpg' | 'png' | 'webp' }
): string {
  const width = options?.width ?? DEFAULT_THUMBNAIL_WIDTH;
  const format = options?.format ?? 'jpg';
  return `${MUX_IMAGE_BASE}/${playbackId}/thumbnail.${format}?width=${width}`;
}

/**
 * アニメーションGIF URLを生成
 */
export function getAnimatedGifUrl(
  playbackId: string,
  options?: { width?: number }
): string {
  const width = options?.width ?? DEFAULT_GIF_WIDTH;
  return `${MUX_IMAGE_BASE}/${playbackId}/animated.gif?width=${width}`;
}

/**
 * HLS ストリームURLを生成
 */
export function getHlsUrl(playbackId: string): string {
  return `${MUX_STREAM_BASE}/${playbackId}.m3u8`;
}

/**
 * MP4 ダウンロードURLを生成（将来用）
 */
export function getMp4Url(playbackId: string): string {
  return `${MUX_STREAM_BASE}/${playbackId}/highest.mp4`;
}
