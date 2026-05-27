import type { RiskLevel } from './types';

/** Generate a unique ID */
export function uid(): string {
  return `tl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Simple hash of a string (for dedup) */
export async function hashString(str: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Determine risk level from confidence score.
 *  Thresholds match backend forensic signal calibration (hybrid AI + heuristic ensemble):
 *  authentic ≈ 0.02–0.30, suspicious ≈ 0.30–0.60, deepfake ≥ 0.60 */
export function classifyRisk(confidence: number): RiskLevel {
  if (confidence >= 0.60) return 'deepfake';
  if (confidence >= 0.30) return 'suspicious';
  return 'authentic';
}

/** Format confidence as a percentage string */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/** Extract domain from URL */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

/** Debounce a function */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Clamp number */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Sleep for ms */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Format milliseconds as human duration */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/** Check if URL is a data URL or blob */
export function isInlineMedia(src: string): boolean {
  return src.startsWith('data:') || src.startsWith('blob:');
}

/** Check if element is in viewport */
export function isInViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return (
    rect.top < window.innerHeight &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.right > 0
  );
}
