"""
Image Deepfake / Manipulation Detection Service

Hybrid AI + forensic analysis pipeline.

PRIMARY signal  (cloud mode):
    Real AI classifier via Hugging Face Inference API (umm-maybe/AI-image-detector).
    Achieves 90-95%+ accuracy on modern AI-generated images.

SECONDARY signals (always run, weighted lower):
    1. ELA  (Error Level Analysis)       — splicing / re-compression artefacts
    2. Noise Consistency                 — GAN uniformity or splice discontinuity
    3. Color Channel Statistics          — kurtosis/skewness anomalies
    4. JPEG Ghost Detection              — double-compression artefacts
    5. Edge Coherence                    — unnatural sharpness distribution
    6. Format / Size signals             — metadata and dimension heuristics

When the AI model is available it dominates the ensemble (weight 0.50).
When unavailable, heuristic weights are redistributed proportionally.
"""

import io
import numpy as np
from loguru import logger

try:
    from PIL import Image, ImageFilter
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    logger.warning("Pillow not available — image forensics disabled")

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logger.warning("OpenCV not available — edge analysis disabled")

from ai_services.ai_model_loader import get_classifier


# ── Signal weights ─────────────────────────────────────────────────────────────
# When AI model IS available (total = 1.0)
_WEIGHTS_WITH_AI = {
    "ai_model":       0.50,
    "ela":            0.08,
    "noise":          0.10,
    "color_stats":    0.08,
    "jpeg_ghost":     0.10,
    "edge_coherence": 0.08,
    "format":         0.06,
}

# When AI model is NOT available — heuristics only (total = 1.0)
_WEIGHTS_HEURISTIC = {
    "ela":            0.25,
    "noise":          0.22,
    "color_stats":    0.15,
    "jpeg_ghost":     0.15,
    "edge_coherence": 0.13,
    "format":         0.10,
}


class ImageDetector:
    def __init__(self, model_path: str = "models/weights"):
        self.model_path = model_path
        self._classifier = get_classifier()
        logger.info(
            f"ImageDetector initialized (PIL={PIL_AVAILABLE}, CV2={CV2_AVAILABLE}, "
            f"AI_model={'ready' if self._classifier.available else 'unavailable'})"
        )

    # ── Public API ─────────────────────────────────────────────────────────────

    async def fast_scan(self, image_bytes: bytes) -> dict:
        """Fast forensic scan — heuristic signals only, no cloud AI model."""
        if not image_bytes:
            return _empty_result("No image data available for analysis", "ImageForensics-Fast")

        signals = self._run_heuristic_signals(image_bytes, include_ghost=False)
        score = _weighted_score(signals, has_ai=False, include_ghost=False)
        score = float(np.clip(score, 0.02, 0.98))

        return {
            "confidence": score,
            "reasons": _build_reasons(signals, score),
            "model": "ImageForensics-Fast (ELA + Noise + ColorStats + EdgeCoherence)",
            "signal_detail": {k: round(v, 4) for k, v in signals.items()},
        }

    async def deep_analysis(self, image_bytes: bytes) -> dict:
        """Deep forensic scan — AI model (if available) + all heuristic signals."""
        if not image_bytes:
            return _empty_result("No image data available for analysis", "ImageForensics-Deep")

        signals = self._run_heuristic_signals(image_bytes, include_ghost=True)

        # ── Primary signal: AI classifier ──────────────────────────────────────
        ai_score = await self._classifier.predict(image_bytes)
        has_ai = ai_score is not None
        if has_ai:
            signals["ai_model"] = ai_score
            logger.info(f"AI classifier returned P(AI-generated) = {ai_score:.4f}")

        score = _weighted_score(signals, has_ai=has_ai, include_ghost=True)
        score = float(np.clip(score, 0.02, 0.98))

        model_name = (
            "ImageForensics-Deep (AI-Classifier + ELA + Noise + ColorStats + JpegGhost + EdgeCoherence)"
            if has_ai else
            "ImageForensics-Deep (ELA + Noise + ColorStats + JpegGhost + EdgeCoherence) [AI model unavailable]"
        )

        return {
            "confidence": score,
            "reasons": _build_reasons(signals, score),
            "model": model_name,
            "signal_detail": {k: round(v, 4) for k, v in signals.items()},
        }

    # ── Heuristic signal pipeline ──────────────────────────────────────────────

    def _run_heuristic_signals(self, image_bytes: bytes, include_ghost: bool) -> dict[str, float]:
        signals: dict[str, float] = {}

        if not PIL_AVAILABLE:
            signals["format"] = _format_signal_bytes(image_bytes)
            return signals

        try:
            img = Image.open(io.BytesIO(image_bytes))
            img.load()
        except Exception as e:
            logger.warning(f"Cannot decode image: {e}")
            signals["format"] = 0.5
            return signals

        signals["ela"]         = _ela_signal(img, image_bytes)
        signals["noise"]       = _noise_signal(img)
        signals["color_stats"] = _color_stats_signal(img)
        signals["format"]      = _format_signal(img, image_bytes)

        if include_ghost:
            signals["jpeg_ghost"] = _jpeg_ghost_signal(img)

        if CV2_AVAILABLE:
            signals["edge_coherence"] = _edge_coherence_signal(img)

        return signals


# ── Signal implementations ─────────────────────────────────────────────────────

def _ela_signal(img: "Image.Image", original_bytes: bytes) -> float:
    """
    Error Level Analysis: re-save at known quality and measure residual.
    Authentic JPEG regions converge quickly; manipulated regions retain higher error.

    NOTE: ELA is effective for **splicing/copy-paste** manipulation but NOT for
    end-to-end AI generation (DALL-E, Midjourney, etc.) where the entire image
    has consistent compression.  Weight is intentionally low (0.08).
    """
    try:
        rgb = img.convert("RGB")
        buf = io.BytesIO()
        rgb.save(buf, format="JPEG", quality=75)
        buf.seek(0)
        recompressed = Image.open(buf).convert("RGB")

        orig_arr   = np.array(rgb,          dtype=np.float32)
        recomp_arr = np.array(recompressed, dtype=np.float32)
        ela = np.abs(orig_arr - recomp_arr)

        mean_ela = float(ela.mean())
        std_ela  = float(ela.std())

        # Per-block max ELA (8×8 blocks)
        h, w = ela.shape[:2]
        bh, bw = max(8, h // 32), max(8, w // 32)
        block_maxs = []
        for y in range(0, h - bh, bh):
            for x in range(0, w - bw, bw):
                block_maxs.append(float(ela[y:y+bh, x:x+bw].max()))

        if block_maxs:
            block_std = float(np.std(block_maxs))
            # Authentic at Q85 re-saved at Q75: block_std typically 3–12
            # Manipulated (splice): 15–40+
            block_score = float(np.clip(block_std / 25.0, 0.0, 1.0))
        else:
            block_score = 0.0

        # Mean ELA: very high mean (>20) → heavy manipulation
        mean_score = 0.0
        if mean_ela > 20:
            mean_score = min(1.0, (mean_ela - 20) / 30.0) * 0.4
        elif mean_ela < 3:
            # Over-compressed / double-saved — mild signal
            mean_score = 0.15

        # Std of ELA across pixels (spatial inconsistency)
        std_score = float(np.clip(std_ela / 20.0, 0.0, 0.4))

        score = 0.5 * block_score + 0.3 * mean_score + 0.2 * std_score
        logger.debug(f"ELA: mean={mean_ela:.2f}, std={std_ela:.2f}, block_std={block_std if block_maxs else 0:.2f} -> {score:.3f}")
        return float(np.clip(score, 0.0, 1.0))
    except Exception as e:
        logger.debug(f"ELA failed: {e}")
        return 0.1


def _noise_signal(img: "Image.Image") -> float:
    """
    Noise Consistency Analysis.
    - GAN images: unnaturally uniform noise across all blocks (low CV).
    - Spliced images: block-level noise discontinuities (high CV).
    - Modern phone photos: LOW noise is NORMAL (computational photography) — NOT suspicious.
    """
    try:
        gray = np.array(img.convert("L"), dtype=np.float32)
        blurred = np.array(img.convert("L").filter(ImageFilter.GaussianBlur(radius=2)), dtype=np.float32)
        noise = gray - blurred

        noise_std = float(noise.std())

        h, w = noise.shape
        bh, bw = max(16, h // 16), max(16, w // 16)
        block_stds = []
        for y in range(0, h - bh, bh):
            for x in range(0, w - bw, bw):
                block_stds.append(float(noise[y:y+bh, x:x+bw].std()))

        if len(block_stds) < 4:
            return 0.05

        block_stds_arr = np.array(block_stds)
        block_mean = float(block_stds_arr.mean())
        cv_noise   = float(block_stds_arr.std() / (block_mean + 1e-6))

        # ─ GAN detection ───────────────────────────────────────────────────────
        # TRUE GAN indicator: BOTH low noise AND extremely uniform blocks (cv < 0.15).
        # Low noise alone is NOT suspicious — modern phones produce very clean images.
        gan_score = 0.0
        if noise_std < 1.5 and cv_noise < 0.15:
            # Very smooth AND uniform → strong GAN signal
            gan_score = float(np.clip((1.5 - noise_std) / 1.5 * 0.5 + (0.15 - cv_noise) / 0.15 * 0.3, 0.0, 0.7))
        elif noise_std < 2.0 and cv_noise < 0.20:
            # Moderately suspicious
            gan_score = float(np.clip((2.0 - noise_std) / 2.0, 0.0, 0.3))

        # ─ Splice detection (block inconsistency) ──────────────────────────────
        # High cv_noise → some blocks have much higher noise → spliced region
        splice_score = float(np.clip((cv_noise - 0.8) / 1.0, 0.0, 0.6))

        score = max(gan_score, splice_score)
        logger.debug(f"Noise: global_std={noise_std:.2f}, CV={cv_noise:.3f} -> {score:.3f}")
        return float(np.clip(score, 0.0, 1.0))
    except Exception as e:
        logger.debug(f"Noise signal failed: {e}")
        return 0.05


def _color_stats_signal(img: "Image.Image") -> float:
    """
    Color Channel Statistical Analysis.
    GAN-generated images show different channel kurtosis/skewness vs natural photos.

    FIXED: Previous version returned 0.05 baseline for ALL images in normal kurtosis
    range, which inflated ensemble scores.  Now returns 0.0 for normal range.
    """
    try:
        rgb = np.array(img.convert("RGB"), dtype=np.float32)
        score = 0.0

        for ch in range(3):
            channel = rgb[:, :, ch].flatten()
            if len(channel) == 0:
                continue
            mu    = float(channel.mean())
            sigma = float(channel.std())
            if sigma < 1e-6:
                score += 0.5  # Flat channel — solid fill, very suspicious
                continue

            norm  = (channel - mu) / sigma
            kurt  = float(np.mean(norm ** 4)) - 3.0   # excess kurtosis
            skew  = float(np.mean(norm ** 3))

            # ─ Kurtosis score ──────────────────────────────────────────────────
            # Natural images: kurt ≈ 0–4 (leptokurtic)
            # GAN images: often kurt < 0 (platykurtic) or > 6 (very sharp peak)
            if kurt < -0.5:
                # Platykurtic — needs to be clearly negative to be meaningful
                kurt_score = float(np.clip(abs(kurt) / 4.0, 0.0, 0.5))
            elif kurt > 6:
                kurt_score = float(np.clip((kurt - 6) / 10.0, 0.0, 0.4))
            else:
                # Normal range — NO contribution (was 0.05, caused false inflation)
                kurt_score = 0.0

            # ─ Skewness score ──────────────────────────────────────────────────
            # Only flag extreme skew (> 1.5), mild skew is normal
            skew_score = float(np.clip((abs(skew) - 1.0) / 3.0, 0.0, 0.3))

            score += kurt_score + skew_score

        score /= 3.0
        logger.debug(f"ColorStats: score={score:.3f}")
        return float(np.clip(score, 0.0, 1.0))
    except Exception as e:
        logger.debug(f"Color stats failed: {e}")
        return 0.05


def _jpeg_ghost_signal(img: "Image.Image") -> float:
    """
    JPEG Ghost Detection.
    Re-compresses image at multiple qualities and finds minimum error vs original.
    A sharp dip at a specific quality reveals the image was previously saved at
    that quality (double-compression indicator).
    """
    try:
        rgb = img.convert("RGB")
        orig_arr = np.array(rgb, dtype=np.float32)

        errors = []
        qualities = [60, 70, 75, 80, 85, 90, 95]
        for q in qualities:
            buf = io.BytesIO()
            rgb.save(buf, format="JPEG", quality=q)
            buf.seek(0)
            recomp = np.array(Image.open(buf).convert("RGB"), dtype=np.float32)
            mse = float(np.mean((orig_arr - recomp) ** 2))
            errors.append(mse)

        errors_arr = np.array(errors)
        min_err = float(errors_arr.min())
        max_err = float(errors_arr.max())

        if max_err < 1e-6:
            return 0.0

        ghost_ratio = min_err / max_err

        # Slope variance reveals non-smooth error curve (ghost behaviour)
        slope_var = float(np.var(np.diff(errors_arr)))

        score = 0.0
        if ghost_ratio < 0.3:
            score += (0.3 - ghost_ratio) / 0.3 * 0.6
        slope_score = min(0.4, slope_var / 10000.0)
        score += slope_score

        logger.debug(f"JpegGhost: ghost_ratio={ghost_ratio:.3f}, slope_var={slope_var:.2f} -> {score:.3f}")
        return float(np.clip(score, 0.0, 1.0))
    except Exception as e:
        logger.debug(f"JPEG ghost failed: {e}")
        return 0.05


def _edge_coherence_signal(img: "Image.Image") -> float:
    """
    Edge Coherence Analysis using OpenCV Canny.
    Deepfakes often exhibit unnaturally uniform edge sharpness.
    """
    try:
        gray = np.array(img.convert("L"))

        # Compute local noise level to guard against high-noise false positives
        blurred = cv2.GaussianBlur(gray, (5, 5), 0).astype(np.float32)
        noise_std = float((gray.astype(np.float32) - blurred).std())

        edges = cv2.Canny(gray, threshold1=50, threshold2=150)
        edge_ratio = float(np.count_nonzero(edges)) / edges.size

        sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        magnitude = np.sqrt(sobel_x**2 + sobel_y**2)
        mag_std  = float(magnitude.std())
        mag_mean = float(magnitude.mean())

        score = 0.0

        # Only apply the smooth-image penalty when the image has low intrinsic noise.
        if noise_std < 8.0:
            if edge_ratio < 0.03:
                score += float(np.clip((0.03 - edge_ratio) / 0.03, 0.0, 0.50))
            elif edge_ratio > 0.30:
                score += float(np.clip((edge_ratio - 0.30) / 0.30, 0.0, 0.25))

        # Gradient uniformity
        uniformity = mag_std / (mag_mean + 1e-6)
        if uniformity < 1.5 and noise_std < 8.0:
            uniformity_score = float(np.clip((1.5 - uniformity) / 1.5, 0.0, 0.30))
        else:
            uniformity_score = 0.0

        score += uniformity_score
        logger.debug(f"EdgeCoherence: edge_ratio={edge_ratio:.4f}, noise_std={noise_std:.2f}, uniformity={uniformity:.3f} -> {score:.3f}")
        return float(np.clip(score, 0.0, 1.0))
    except Exception as e:
        logger.debug(f"Edge coherence failed: {e}")
        return 0.05


def _format_signal(img: "Image.Image", image_bytes: bytes) -> float:
    """Format and metadata signals."""
    score = 0.0
    try:
        w, h = img.size
        if w == 0 or h == 0:
            return 0.5

        # Power-of-2 dimensions (small signal — common in synthetic datasets)
        is_power_of_2 = lambda n: n > 0 and (n & (n - 1)) == 0
        if is_power_of_2(w) and is_power_of_2(h):
            score += 0.05

        # Very small images are less reliable
        if w < 128 or h < 128:
            score += 0.10

        # EXIF missing in JPEG → often indicates re-save / manipulation
        if img.format == "JPEG":
            exif = img.info.get("exif", b"")
            if not exif:
                score += 0.08

        # Unusual aspect ratios
        ratio = w / h
        if ratio > 4.0 or ratio < 0.25:
            score += 0.08

    except Exception as e:
        logger.debug(f"Format signal failed: {e}")
    return float(np.clip(score, 0.0, 1.0))


def _format_signal_bytes(image_bytes: bytes) -> float:
    """Minimal format signal from raw bytes when PIL is unavailable."""
    if not image_bytes:
        return 0.5
    if image_bytes[:2] == b'\xff\xd8':
        return 0.1  # JPEG
    if image_bytes[:8] == b'\x89PNG\r\n\x1a\n':
        return 0.15  # PNG
    return 0.2


# ── Ensemble scoring ───────────────────────────────────────────────────────────

def _weighted_score(signals: dict[str, float], has_ai: bool, include_ghost: bool) -> float:
    """Compute a weighted average of available signals."""
    weights = dict(_WEIGHTS_WITH_AI if has_ai else _WEIGHTS_HEURISTIC)

    # Remove unavailable signals
    if not has_ai:
        weights.pop("ai_model", None)
    if not include_ghost:
        weights.pop("jpeg_ghost", None)
    if "edge_coherence" not in signals:
        weights.pop("edge_coherence", None)

    # Only use weights for signals we actually have
    active_weights = {k: w for k, w in weights.items() if k in signals}
    total_weight = sum(active_weights.values())
    if total_weight < 1e-6:
        return 0.1

    weighted_avg = sum(signals[k] * active_weights[k] for k in active_weights) / total_weight
    
    # Prevent score dilution: deepfake detection is an OR problem.
    # If any single forensic test shows strong evidence of manipulation, the media is manipulated.
    max_signal = max(signals.values()) if signals else 0.0
    if max_signal >= 0.6:
        # Strong manipulation detected in at least one signal -> override baseline dilution
        score = max_signal
    elif max_signal > 0.3:
        # Moderate anomaly -> blend but strongly favor the anomalous signal
        score = weighted_avg + (max_signal - weighted_avg) * 0.8
    else:
        # Normal range -> use the weighted average
        score = weighted_avg

    return score


# ── Reason generation ──────────────────────────────────────────────────────────

def _build_reasons(signals: dict[str, float], overall: float) -> list[str]:
    """Build human-readable reasons from individual signal scores."""
    reasons = []

    ai = signals.get("ai_model")
    if ai is not None:
        if ai > 0.75:
            reasons.append(f"AI classifier detected strong indicators of AI-generated content "
                           f"(confidence: {ai:.0%})")
        elif ai > 0.50:
            reasons.append(f"AI classifier indicates likely AI-generated content "
                           f"(confidence: {ai:.0%})")
        elif ai > 0.30:
            reasons.append(f"AI classifier shows mild AI-generation indicators "
                           f"(confidence: {ai:.0%})")
        else:
            reasons.append(f"AI classifier indicates likely authentic content "
                           f"(confidence: {1-ai:.0%})")

    ela = signals.get("ela", 0.0)
    if ela > 0.5:
        reasons.append("Error level analysis detected inconsistent JPEG compression — "
                       "suggests localized editing or image splicing")
    elif ela > 0.25:
        reasons.append("Mild ELA anomaly — re-compression patterns slightly inconsistent")

    noise = signals.get("noise", 0.0)
    if noise > 0.55:
        reasons.append("Noise distribution across image blocks is inconsistent — "
                       "hallmark of pasted or AI-generated regions")
    elif noise > 0.3:
        reasons.append("Unnaturally uniform noise pattern — possible GAN-generated content")

    color = signals.get("color_stats", 0.0)
    if color > 0.5:
        reasons.append("Channel statistics (kurtosis/skewness) deviate from natural photo norms")
    elif color > 0.3:
        reasons.append("Mild color distribution anomaly detected")

    ghost = signals.get("jpeg_ghost", 0.0)
    if ghost > 0.5:
        reasons.append("JPEG ghost artefact detected — image was likely re-saved at a different "
                       "quality (double-compression)")
    elif ghost > 0.25:
        reasons.append("Mild JPEG ghost present — minor re-compression detected")

    edge = signals.get("edge_coherence", 0.0)
    if edge > 0.5:
        reasons.append("Edge sharpness distribution is unnatural — "
                       "too uniform for an authentic photograph")
    elif edge > 0.3:
        reasons.append("Edge coherence slightly irregular")

    fmt = signals.get("format", 0.0)
    if fmt > 0.25:
        reasons.append("Format metadata anomaly — missing EXIF data or unusual image dimensions")

    if overall < 0.2:
        reasons.append("All forensic signals within expected range for authentic media")

    return reasons or ["Forensic analysis completed — signals inconclusive"]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _empty_result(message: str, model: str) -> dict:
    return {
        "confidence": 0.0,
        "reasons": [message],
        "model": model,
        "signal_detail": {},
    }
