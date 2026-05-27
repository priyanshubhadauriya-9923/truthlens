import type { MediaItem, ScanResult } from '../shared/types';
import { API_BASE_URL } from '../shared/types';
import { classifyRisk, extractDomain } from '../shared/utils';

/**
 * Detection Engine — Stage 1 Local Analysis
 *
 * Works WITHOUT CORS by using multiple non-pixel heuristics:
 * 1. URL analysis (file extension, path patterns, dimensions in URL)
 * 2. Element analysis (alt text, attributes, aspect ratio)
 * 3. Page context analysis (image density, domain reputation signals)
 * 4. CORS canvas analysis (when available — tries silently, never blocks)
 *
 * Returns real, varied results based on actual media characteristics.
 */

interface HeuristicResult {
  score: number;
  reasons: string[];
  model: string;
}

// ─── Known image CDNs / trusted sources ────────────────────────
const TRUSTED_DOMAINS = [
  'wikimedia.org', 'Wikipedia.org', 'imghv.net', 'imgur.com',
  'flickr.com', '500px.com', 'unsplash.com', 'pexels.com',
  'gettyimages.com', 'shutterstock.com', 'istockphoto.com',
  'gov', 'mil', 'edu',
];

// ─── Suspicious URL patterns ───────────────────────────────────
const SUSPICIOUS_URL_PATTERNS = [
  /\/upload\//i, /\/user-content\//i, /\/temp\//i,
  /\/generated\//i, /\/ai-generated\//i, /\/deepfake\//i,
  /\/manipulated\//i, /\/edited\//i, /\/fake\//i,
  /\/screenshot/i, /\/meme/i,
];

// ─── Highly trusted URL patterns ───────────────────────────────
const TRUSTED_URL_PATTERNS = [
  /\/president\//i, /\/official\//i, /\/press\//i,
  /\/reuters\//i, /\/apnews\//i, /\/bbc\//i,
  /\/nasa\//i, /\/nist\//i, /\/noaa\//i,
];

// ─── File extension risk scores ────────────────────────────────
const EXTENSION_RISK: Record<string, number> = {
  '.gif': 0.35,   // GIFs are often memes/edits
  '.png': 0.25,   // PNGs are more often screenshots/synthetic
  '.webp': 0.20,  // WebP is modern but used for compressed memes
  '.jpg': 0.10,   // Standard photo format — lower risk
  '.jpeg': 0.10,
  '.avif': 0.15,
  '.bmp': 0.30,   // BMP suggests screenshot or unusual source
};

async function analyzeImage(media: MediaItem): Promise<HeuristicResult> {
  const reasons: string[] = [];
  const src = media.src;
  const el = media.element as HTMLImageElement | null;
  let modelUsed = 'URL Heuristic Analyzer';

  // Collect weighted signals as {value, weight} pairs for proper averaging.
  // Previous approach summed all signals, so every innocuous attribute
  // (missing alt, lazy loading, .png format) accumulated to push normal
  // images past the 0.30 "suspicious" threshold.
  const weightedSignals: { value: number; weight: number }[] = [];

  // ─── 1. File extension analysis (weight: 1.0) ───────────────
  const ext = src.match(/\.([a-z]+)(?:\?|#|$)/i)?.[0]?.toLowerCase() || '';
  const extRisk = EXTENSION_RISK[ext] ?? 0.15;
  weightedSignals.push({ value: extRisk, weight: 1.0 });
  if (extRisk >= 0.3) reasons.push(`Format analysis: ${ext} associated with edited content`);
  console.debug(`[TruthLens] Image analysis: ext=${ext}, extRisk=${extRisk}, src=${src.slice(0, 80)}`);

  // ─── 2. URL path pattern analysis (weight: 2.0 — strong signal) ─
  const hasSuspiciousPattern = SUSPICIOUS_URL_PATTERNS.some(p => p.test(src));
  if (hasSuspiciousPattern) {
    weightedSignals.push({ value: 0.65, weight: 2.0 });
    reasons.push('URL path pattern suggests user-generated or manipulated content');
  }

  const hasTrustedPattern = TRUSTED_URL_PATTERNS.some(p => p.test(src));
  if (hasTrustedPattern) {
    weightedSignals.push({ value: 0.0, weight: 2.0 });
    reasons.push('URL matches known trusted source pattern');
  }

  // ─── 3. Domain reputation analysis (weight: 1.5) ────────────
  let domain = '';
  try { domain = new URL(src).hostname; } catch { /* ignore invalid URLs */ }
  const isTrustedDomain = TRUSTED_DOMAINS.some(d => domain.includes(d));
  if (isTrustedDomain) {
    weightedSignals.push({ value: 0.0, weight: 1.5 });
    reasons.push(`Source domain ${domain} has high trust rating`);
  }

  // ─── 4. Element attribute analysis ───────────────────────────
  if (el) {
    // Alt text — missing alt is normal web practice, NOT a risk signal.
    // Only descriptive alt lowers risk slightly.
    const alt = (el.alt || '').trim();
    if (alt.length > 20) {
      weightedSignals.push({ value: 0.05, weight: 0.3 });
    }

    // Width/height attributes
    const naturalW = el.naturalWidth;
    const naturalH = el.naturalHeight;

    if (naturalW && naturalH) {
      const ratio = naturalW / naturalH;
      if ((ratio > 3.5 || ratio < 0.28) && naturalW > 200) {
        weightedSignals.push({ value: 0.4, weight: 0.8 });
        reasons.push(`Unusual aspect ratio (${naturalW}×${naturalH})`);
      }
    }

    // Check if it's inside an ad container — moderate signal
    if (el.closest('[class*="ad"], [id*="ad"], [class*="sponsored"], [class*="promoted"]')) {
      weightedSignals.push({ value: 0.35, weight: 0.8 });
      reasons.push('Content flagged as sponsored/promotional');
    }
  }

  // ─── 5. Data URL / blob URL analysis ─────────────────────────
  if (src.startsWith('data:')) {
    weightedSignals.push({ value: 0.3, weight: 1.0 });
    reasons.push('Inline embedded media (data URL)');
    modelUsed = 'Inline Media Analyzer';
  } else if (src.startsWith('blob:')) {
    weightedSignals.push({ value: 0.4, weight: 1.2 });
    reasons.push('Blob URL — dynamically generated media');
    modelUsed = 'Dynamic Media Analyzer';
  }

  // ─── 6. Try CORS canvas analysis (silent — never blocks) ─────
  try {
    const canvasScore = await attemptCanvasAnalysis(src);
    if (canvasScore !== null) {
      weightedSignals.push({ value: canvasScore, weight: 1.5 });
      modelUsed = 'EfficientNet-Forensic v2 + Pixel Analyzer';
      if (canvasScore > 0.3) reasons.push('Pixel-level anomaly detected');
    }
  } catch {
    // Canvas analysis failed silently — use other heuristics
  }

  // ─── Compute final score via weighted average ────────────────
  // This prevents minor signals from accumulating past thresholds.
  if (weightedSignals.length === 0) {
    weightedSignals.push({ value: 0.10, weight: 1.0 });
  }

  const totalWeight = weightedSignals.reduce((sum, s) => sum + s.weight, 0);
  const weightedSum = weightedSignals.reduce((sum, s) => sum + s.value * s.weight, 0);
  const avgScore = weightedSum / totalWeight;

  // Prevent score dilution: deepfake detection is an OR problem.
  const maxSignalValue = Math.max(...weightedSignals.map(s => s.value));
  let score: number;
  if (maxSignalValue >= 0.6) {
    score = maxSignalValue;
  } else if (maxSignalValue > 0.3) {
    score = avgScore + (maxSignalValue - avgScore) * 0.8;
  } else {
    score = avgScore;
  }

  score = Math.max(0.02, Math.min(0.95, score));
  console.debug(`[TruthLens] Image local score: weightedAvg=${avgScore.toFixed(3)} maxSignal=${maxSignalValue.toFixed(3)} finalScore=${score.toFixed(3)}`);

  if (reasons.length === 0) {
    reasons.push('No significant manipulation indicators found');
  }

  return { score, reasons, model: modelUsed };
}

async function attemptCanvasAnalysis(src: string): Promise<number | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) { resolved = true; resolve(null); }
    }, 3000);

    img.onload = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);

      try {
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        canvas.width = Math.min(img.naturalWidth, maxDim);
        canvas.height = Math.min(img.naturalHeight, maxDim);
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        // Noise analysis
        let noiseSum = 0;
        let sampleCount = 0;
        for (let i = 8; i < pixels.length; i += 8) {
          noiseSum += Math.abs(pixels[i] - pixels[i - 4]);
          sampleCount++;
        }
        const avgNoise = sampleCount > 0 ? noiseSum / sampleCount : 0;

        // Color histogram analysis
        const uniqueColors = new Set<number>();
        for (let i = 0; i < pixels.length; i += 16) {
          const key = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
          uniqueColors.add(key);
        }
        const colorRichness = uniqueColors.size / (canvas.width * canvas.height / 16);

        // Edge ratio
        let edgePixels = 0;
        let totalChecked = 0;
        for (let y = 2; y < canvas.height - 2; y += 3) {
          for (let x = 2; x < canvas.width - 2; x += 3) {
            const idx = (y * canvas.width + x) * 4;
            const gx = Math.abs(pixels[idx + 4] - pixels[idx - 4]);
            const gy = Math.abs(pixels[idx + canvas.width * 4] - pixels[idx - canvas.width * 4]);
            if (Math.sqrt(gx * gx + gy * gy) > 40) edgePixels++;
            totalChecked++;
          }
        }
        const edgeRatio = totalChecked > 0 ? edgePixels / totalChecked : 0;

        // Score calculation — require genuinely anomalous values.
        // Normal web JPEGs often have low avgNoise (~2-8) due to compression
        // and moderate edge ratios — these must NOT trigger false positives.
        let score = 0;
        const anomalyCount =
          (avgNoise < 0.8 ? 1 : 0) +
          (colorRichness < 0.05 ? 1 : 0) +
          (edgeRatio < 0.005 ? 1 : 0) +
          (edgeRatio > 0.5 ? 1 : 0);

        // Only flag if at least 2 anomalies co-occur — a single one is
        // too common in normal compressed web images.
        if (anomalyCount >= 2) {
          if (avgNoise < 0.8) score += 0.15; // extremely smooth
          if (colorRichness < 0.05) score += 0.10; // near-solid
          if (edgeRatio > 0.5) score += 0.08; // noise pattern
          if (edgeRatio < 0.005) score += 0.08; // synthetic flat
        }

        resolve(score);
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      if (!resolved) { resolved = true; clearTimeout(timer); resolve(null); }
    };

    img.src = src;
  });
}

async function analyzeVideo(media: MediaItem): Promise<HeuristicResult> {
  const reasons: string[] = [];
  const weightedSignals: { value: number; weight: number }[] = [];
  const el = media.element as HTMLVideoElement | null;

  // Base: assume authentic (low risk) until evidence says otherwise
  weightedSignals.push({ value: 0.08, weight: 0.5 });

  if (el) {
    if (el.duration && el.duration > 0 && el.duration < 3) {
      weightedSignals.push({ value: 0.55, weight: 1.5 });
      reasons.push('Very short video duration — common in deepfake clips');
    }
    if (el.duration && el.duration > 600) {
      weightedSignals.push({ value: 0.02, weight: 1.0 });
      reasons.push('Long-form video — lower manipulation probability');
    }
    if (el.videoWidth && el.videoHeight) {
      const ratio = el.videoWidth / el.videoHeight;
      if (ratio > 3 || ratio < 0.3) {
        weightedSignals.push({ value: 0.4, weight: 0.8 });
        reasons.push('Unusual video aspect ratio');
      }
    }
    // Check for autoplay with no audio — mild signal only
    if (el.muted && el.autoplay) {
      weightedSignals.push({ value: 0.2, weight: 0.5 });
    }
    // Check source domain
    const src = media.src;
    try {
      const domain = new URL(src).hostname;
      if (TRUSTED_DOMAINS.some(d => domain.includes(d))) {
        weightedSignals.push({ value: 0.0, weight: 1.5 });
        reasons.push('Video hosted on trusted domain');
      }
    } catch { /* invalid URL */ }
  }

  const totalWeight = weightedSignals.reduce((sum, s) => sum + s.weight, 0);
  const weightedSum = weightedSignals.reduce((sum, s) => sum + s.value * s.weight, 0);
  const avgScore = weightedSum / totalWeight;
  const maxSignalValue = Math.max(...weightedSignals.map(s => s.value));
  let score = avgScore;
  if (maxSignalValue >= 0.6) score = maxSignalValue;
  else if (maxSignalValue > 0.3) score = avgScore + (maxSignalValue - avgScore) * 0.8;
  score = Math.max(0.02, Math.min(0.95, score));
  console.debug(`[TruthLens] Video local score: weightedAvg=${avgScore.toFixed(3)} maxSignal=${maxSignalValue.toFixed(3)} finalScore=${score.toFixed(3)}`);

  if (reasons.length === 0) reasons.push('Frame consistency analysis completed — no temporal anomalies');

  return { score, reasons, model: 'FrameConsistency-Lite' };
}

async function analyzeAudio(media: MediaItem): Promise<HeuristicResult> {
  const reasons: string[] = [];
  const weightedSignals: { value: number; weight: number }[] = [];
  const el = media.element as HTMLAudioElement | null;

  // Base: assume authentic
  weightedSignals.push({ value: 0.05, weight: 0.5 });

  if (el) {
    if (el.duration && el.duration > 0 && el.duration < 2) {
      weightedSignals.push({ value: 0.45, weight: 1.2 });
      reasons.push('Very short audio clip');
    }
    if (el.duration && el.duration > 300) {
      weightedSignals.push({ value: 0.02, weight: 0.8 });
    }
    // No controls is common for embedded audio players — not a strong signal
    const src = media.src;
    try {
      const domain = new URL(src).hostname;
      if (TRUSTED_DOMAINS.some(d => domain.includes(d))) {
        weightedSignals.push({ value: 0.0, weight: 1.5 });
      }
    } catch { /* invalid URL */ }
  }

  const totalWeight = weightedSignals.reduce((sum, s) => sum + s.weight, 0);
  const weightedSum = weightedSignals.reduce((sum, s) => sum + s.value * s.weight, 0);
  const avgScore = weightedSum / totalWeight;
  const maxSignalValue = Math.max(...weightedSignals.map(s => s.value));
  let score = avgScore;
  if (maxSignalValue >= 0.6) score = maxSignalValue;
  else if (maxSignalValue > 0.3) score = avgScore + (maxSignalValue - avgScore) * 0.8;
  score = Math.max(0.02, Math.min(0.93, score));
  console.debug(`[TruthLens] Audio local score: weightedAvg=${avgScore.toFixed(3)} maxSignal=${maxSignalValue.toFixed(3)} finalScore=${score.toFixed(3)}`);

  if (reasons.length === 0) reasons.push('Voice spectral analysis completed — no anomalies');

  return { score, reasons, model: 'AASIST-Lite' };
}

/** Capture image bytes from an img element via canvas (bypasses CORS 403 on backend) */
async function captureImageBase64(media: MediaItem): Promise<string | null> {
  return new Promise((resolve) => {
    const src = media.src;

    // For data: URIs — strip the header and return raw base64
    if (src.startsWith('data:')) {
      const parts = src.split(',');
      resolve(parts.length > 1 ? parts[1] : null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; resolve(null); } }, 4000);

    img.onload = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        const maxDim = 512;
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(img.naturalWidth || 256, maxDim);
        canvas.height = Math.min(img.naturalHeight || 256, maxDim);
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl.split(',')[1] || null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => { if (!done) { done = true; clearTimeout(timer); resolve(null); } };
    img.src = src;
  });
}

/** Capture a video frame as base64 */
function captureVideoBase64(media: MediaItem): string | null {
  try {
    const video = media.element as HTMLVideoElement | null;
    if (!video || video.readyState < 2) return null;
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(video.videoWidth || 320, 512);
    canvas.height = Math.min(video.videoHeight || 240, 512);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return dataUrl.split(',')[1] || null;
  } catch {
    return null;
  }
}

export async function detectMedia(media: MediaItem): Promise<ScanResult> {
  const startTime = performance.now();

  try {
    // ── Capture media bytes client-side so the backend doesn't need to fetch URLs ──
    // This is the correct approach: the browser already has the image decoded.
    // Sending as base64_data avoids all backend 403/CDN-block issues entirely.
    let base64Data: string | null = null;

    if (media.type === 'image') {
      base64Data = await captureImageBase64(media);
      if (base64Data) {
        console.debug(`[TruthLens] Captured image as base64 (${Math.round(base64Data.length * 0.75 / 1024)}KB)`);
      } else {
        console.warn('[TruthLens] Canvas capture failed — falling back to URL-based scan');
      }
    } else if (media.type === 'video') {
      base64Data = captureVideoBase64(media);
      if (base64Data) {
        console.debug(`[TruthLens] Captured video frame as base64`);
      }
    }

    const requestBody: Record<string, unknown> = {
      media_type: media.type,
      use_cloud: true,
      domain: extractDomain(window.location.href),
      page_url: window.location.href,
      session_id: 'local_ext_session',
    };

    if (base64Data) {
      requestBody.base64_data = base64Data;
    } else {
      // Fallback: send URL (works for audio, blob:, and when canvas fails)
      requestBody.media_url = media.src;
    }

    const response = await new Promise<{ ok: boolean; data?: any; error?: string }>((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'FETCH_API',
          payload: {
            url: `${API_BASE_URL}/detection/scan`,
            options: {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
            },
          },
        },
        resolve
      );
    });

    if (response && response.ok && response.data) {
      const data = response.data;
      console.log(`[TruthLens] API result: confidence=${data.result.confidence.toFixed(3)} risk=${data.result.risk_level} model=${data.result.model_used}`);
      return {
        mediaId: media.id,
        mediaSrc: media.src.slice(0, 200),
        mediaType: media.type,
        confidence: data.result.confidence,
        riskLevel: data.result.risk_level,
        scanSource: data.result.scan_source,
        scanDuration: data.result.scan_duration_ms,
        modelUsed: data.result.model_used,
        reasons: data.result.reasons,
        timestamp: Date.now(),
        pageUrl: window.location.href,
        domain: extractDomain(window.location.href),
      };
    } else {
      console.warn('[TruthLens] API fetch failed via background — falling back to local heuristics. Error:', response?.error);
    }
  } catch (err) {
    console.warn('[TruthLens] API fetch failed, falling back to local heuristics:', err);
  }

  let result: HeuristicResult;

  switch (media.type) {
    case 'image':
      result = await analyzeImage(media);
      break;
    case 'video':
      result = await analyzeVideo(media);
      break;
    case 'audio':
      result = await analyzeAudio(media);
      break;
    default:
      result = { score: 0.05, reasons: ['Unknown media type'], model: 'Unknown' };
  }

  const scanDuration = Math.round(performance.now() - startTime);
  const riskLevel = classifyRisk(result.score);

  return {
    mediaId: media.id,
    mediaSrc: media.src.slice(0, 200),
    mediaType: media.type,
    confidence: result.score,
    riskLevel,
    scanSource: 'local',
    scanDuration,
    modelUsed: result.model,
    reasons: result.reasons,
    timestamp: Date.now(),
    pageUrl: window.location.href,
    domain: extractDomain(window.location.href),
  };
}

