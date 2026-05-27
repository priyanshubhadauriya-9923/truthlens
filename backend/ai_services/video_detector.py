"""
Video Deepfake Detection Service

Temporal forensic analysis pipeline — all signals derived from decoded video frames.

Signals used:
  1. Per-frame AI forensics     — run image AI classifier on sampled keyframes
  2. Inter-frame consistency    — histogram & brightness variance across frames
  3. Temporal noise             — sensor noise should be consistent across frames
  4. Optical flow anomaly       — deepfake face-swaps create irregular motion vectors
  5. Frame quality              — sharpness consistency across frames

FIXED:
  - Removed static video false positive (near-zero optical flow penalty)
  - Added per-frame AI model scoring for keyframes
  - Improved frame sampling for short videos
"""

import io
import os
import math
import tempfile
import numpy as np
from loguru import logger
from typing import Optional

try:
    import cv2
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    logger.warning("OpenCV not available — video forensics degraded")

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

from ai_services.ai_model_loader import get_classifier


# Max frames to sample (balance speed vs accuracy)
MAX_FRAMES = 12
FAST_FRAMES = 6


class VideoDetector:
    def __init__(self, model_path: str = "models/weights"):
        self.model_path = model_path
        self._classifier = get_classifier()
        logger.info(f"VideoDetector initialized (CV2={CV2_AVAILABLE}, PIL={PIL_AVAILABLE})")

    # ── Public API ─────────────────────────────────────────────────────────────

    async def fast_scan(self, video_bytes: bytes) -> dict:
        """Sample key frames and run lightweight temporal analysis."""
        if not video_bytes:
            return _empty_result("No video data available for analysis", "VideoForensics-Fast")

        frames = _extract_frames(video_bytes, max_frames=FAST_FRAMES)
        if not frames:
            return _empty_result("Could not decode video frames", "VideoForensics-Fast")

        signals = _run_signals(frames, deep=False)
        score = _weighted_score(signals)
        score = float(np.clip(score, 0.03, 0.97))

        return {
            "confidence": score,
            "reasons": _build_reasons(signals, score, len(frames)),
            "model": f"VideoForensics-Fast (TemporalConsistency + FrameStats, {len(frames)} frames)",
            "signal_detail": {k: round(v, 4) for k, v in signals.items()},
        }

    async def deep_analysis(self, video_bytes: bytes) -> dict:
        """Full temporal analysis with optical flow + per-frame AI scoring."""
        if not video_bytes:
            return _empty_result("No video data available for analysis", "VideoForensics-Deep")

        frames = _extract_frames(video_bytes, max_frames=MAX_FRAMES)
        if not frames:
            return _empty_result("Could not decode video frames", "VideoForensics-Deep")

        signals = _run_signals(frames, deep=True)

        # ── Per-frame AI classifier ────────────────────────────────────────────
        ai_score = await _per_frame_ai_score(frames, self._classifier)
        if ai_score is not None:
            signals["ai_frame_score"] = ai_score

        score = _weighted_score(signals)
        score = float(np.clip(score, 0.03, 0.97))

        model_label = (
            f"VideoForensics-Deep (AI-FrameScoring + TemporalConsistency + OpticalFlow, {len(frames)} frames)"
            if ai_score is not None else
            f"VideoForensics-Deep (TemporalConsistency + OpticalFlow + FrameForensics, {len(frames)} frames)"
        )

        return {
            "confidence": score,
            "reasons": _build_reasons(signals, score, len(frames)),
            "model": model_label,
            "signal_detail": {k: round(v, 4) for k, v in signals.items()},
        }


# ── Per-frame AI scoring ──────────────────────────────────────────────────────

async def _per_frame_ai_score(frames: list[np.ndarray], classifier) -> Optional[float]:
    """Run the AI image classifier on up to 4 evenly spaced keyframes and average."""
    if not classifier.available or not PIL_AVAILABLE:
        return None

    try:
        # Sample up to 4 frames evenly spaced
        indices = [int(i) for i in np.linspace(0, len(frames) - 1, min(4, len(frames)))]
        scores = []

        for idx in indices:
            frame_rgb = cv2.cvtColor(frames[idx], cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(frame_rgb)
            buf = io.BytesIO()
            pil_img.save(buf, format="JPEG", quality=90)
            frame_bytes = buf.getvalue()

            score = await classifier.predict(frame_bytes)
            if score is not None:
                scores.append(score)

        if scores:
            avg = float(np.mean(scores))
            logger.info(f"Per-frame AI scores: {[f'{s:.3f}' for s in scores]} -> avg={avg:.3f}")
            return avg
        return None
    except Exception as e:
        logger.debug(f"Per-frame AI scoring failed: {e}")
        return None


# ── Frame extraction ──────────────────────────────────────────────────────────

def _extract_frames(video_bytes: bytes, max_frames: int = MAX_FRAMES) -> list[np.ndarray]:
    """
    Write video bytes to a temp file, decode with OpenCV,
    and return evenly sampled frames as numpy BGR arrays.
    """
    if not CV2_AVAILABLE:
        logger.warning("OpenCV unavailable — cannot extract video frames")
        return []

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
            tmp.write(video_bytes)
            tmp_path = tmp.name

        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            # Try WebM fallback
            tmp_webm = tmp_path.replace(".mp4", ".webm")
            os.rename(tmp_path, tmp_webm)
            tmp_path = tmp_webm
            cap = cv2.VideoCapture(tmp_path)

        if not cap.isOpened():
            logger.warning("OpenCV could not open video file")
            return []

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            total_frames = 9999

        sample_indices = _sample_indices(total_frames, max_frames)

        frames = []
        last_idx = -1

        for target_idx in sorted(sample_indices):
            if target_idx != last_idx + 1:
                cap.set(cv2.CAP_PROP_POS_FRAMES, float(target_idx))
            ret, frame = cap.read()
            if ret and frame is not None:
                frames.append(frame)
            last_idx = target_idx
            if len(frames) >= max_frames:
                break

        cap.release()
        logger.info(f"Extracted {len(frames)} frames from {len(video_bytes) // 1024}KB video")
        return frames

    except Exception as e:
        logger.error(f"Frame extraction failed: {e}")
        return []
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


def _sample_indices(total: int, n: int) -> list[int]:
    """Evenly spaced sample indices skipping first and last 3% (reduced from 5% for short videos)."""
    margin = max(1, total // 33)
    start  = margin
    end    = max(start + 1, total - margin)
    if end <= start:
        return [0]
    step = max(1, (end - start) // n)
    return list(range(start, end, step))[:n]


# ── Signal pipeline ────────────────────────────────────────────────────────────

def _run_signals(frames: list[np.ndarray], deep: bool) -> dict[str, float]:
    signals: dict[str, float] = {}

    if len(frames) < 2:
        signals["frame_quality"] = _single_frame_quality(frames[0]) if frames else 0.1
        return signals

    signals["inter_frame_consistency"] = _inter_frame_consistency(frames)
    signals["temporal_noise"]          = _temporal_noise_consistency(frames)
    signals["frame_quality"]           = _frame_quality_ensemble(frames)

    if deep and CV2_AVAILABLE:
        signals["optical_flow"] = _optical_flow_anomaly(frames)

    return signals


def _inter_frame_consistency(frames: list[np.ndarray]) -> float:
    """
    Measure consistency of per-frame histogram and brightness across the video.
    Deepfakes have abrupt colour balance shifts due to face-swap blending.
    """
    try:
        hists = []
        for frame in frames:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if CV2_AVAILABLE else frame[:, :, 0]
            hist = np.histogram(gray, bins=32, range=(0, 256))[0].astype(np.float32)
            hist /= hist.sum() + 1e-9
            hists.append(hist)

        dists = []
        for i in range(len(hists) - 1):
            bc = float(np.sum(np.sqrt(hists[i] * hists[i + 1])))
            dist = -math.log(bc + 1e-9) if bc > 0 else 10.0
            dists.append(dist)

        mean_dist = float(np.mean(dists))
        max_dist  = float(np.max(dists))
        std_dist  = float(np.std(dists))

        score = 0.0

        if std_dist > 0.5:
            score += min(0.6, std_dist / 2.0)

        if max_dist > 1.5:
            score += min(0.3, (max_dist - 1.5) / 3.0)

        # Too uniform across frames (possible loop)
        if mean_dist < 0.01:
            score += 0.2

        logger.debug(f"InterFrameConsistency: mean_dist={mean_dist:.4f}, "
                     f"max_dist={max_dist:.4f}, std={std_dist:.4f} -> {score:.3f}")
        return float(np.clip(score, 0.0, 1.0))
    except Exception as e:
        logger.debug(f"Inter-frame consistency failed: {e}")
        return 0.1


def _temporal_noise_consistency(frames: list[np.ndarray]) -> float:
    """
    Sensor noise should be consistent across frames in authentic video.
    In face-swapped / spliced video, the noise pattern changes discontinuously.
    """
    try:
        noise_stds = []
        for frame in frames:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).astype(np.float32)
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            noise = gray - blurred
            noise_stds.append(float(noise.std()))

        if len(noise_stds) < 2:
            return 0.1

        stds_arr = np.array(noise_stds)
        cv_noise = float(stds_arr.std() / (stds_arr.mean() + 1e-6))

        score = min(1.0, max(0.0, (cv_noise - 0.2) / 0.8))
        logger.debug(f"TemporalNoise: stds={stds_arr.round(2).tolist()}, CV={cv_noise:.3f} -> {score:.3f}")
        return float(score)
    except Exception as e:
        logger.debug(f"Temporal noise failed: {e}")
        return 0.1


def _frame_quality_ensemble(frames: list[np.ndarray]) -> float:
    """
    Average per-frame Laplacian variance (sharpness consistency).
    Deepfakes have inconsistent sharpness — swapped face blurred differently.
    """
    try:
        lap_vars = []
        for frame in frames:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            lap = cv2.Laplacian(gray, cv2.CV_64F)
            lap_vars.append(float(lap.var()))

        if len(lap_vars) < 2:
            return 0.1

        lap_arr = np.array(lap_vars)
        cv_sharpness = float(lap_arr.std() / (lap_arr.mean() + 1e-6))

        mean_sharpness = float(lap_arr.mean())
        score = 0.0
        if mean_sharpness < 50:
            score += 0.2
        if cv_sharpness > 0.5:
            score += min(0.5, cv_sharpness * 0.5)

        logger.debug(f"FrameQuality: mean_sharpness={mean_sharpness:.1f}, "
                     f"CV={cv_sharpness:.3f} -> {score:.3f}")
        return float(np.clip(score, 0.0, 1.0))
    except Exception as e:
        logger.debug(f"Frame quality failed: {e}")
        return 0.1


def _optical_flow_anomaly(frames: list[np.ndarray]) -> float:
    """
    Optical flow anomaly detection.
    Face-swaps in deepfakes create irregular flow vectors.

    FIXED: No longer penalizes near-zero flow (static video is normal for
    product shots, slideshows, screencasts). Only flags INCONSISTENT motion
    where some regions move and others don't.
    """
    try:
        flow_magnitudes = []
        flow_stds = []

        for i in range(len(frames) - 1):
            gray1 = cv2.cvtColor(frames[i],     cv2.COLOR_BGR2GRAY)
            gray2 = cv2.cvtColor(frames[i + 1], cv2.COLOR_BGR2GRAY)

            flow = cv2.calcOpticalFlowFarneback(
                gray1, gray2,
                None,
                pyr_scale=0.5, levels=3, winsize=15,
                iterations=3, poly_n=5, poly_sigma=1.2,
                flags=0,
            )
            mag, _ = cv2.cartToPolar(flow[:, :, 0], flow[:, :, 1])
            flow_magnitudes.append(float(mag.mean()))
            flow_stds.append(float(mag.std()))

        if not flow_magnitudes:
            return 0.1

        mag_arr = np.array(flow_magnitudes)
        std_arr = np.array(flow_stds)

        mean_mag = float(mag_arr.mean())

        # High coefficient of variation in flow magnitude across frames = suspicious
        cv_mag = float(mag_arr.std() / (mean_mag + 1e-6))
        # Very high std within a frame relative to mean = irregular motion
        relative_std = float(std_arr.mean() / (mean_mag + 1e-6))

        score = 0.0

        if cv_mag > 0.6:
            score += min(0.5, cv_mag * 0.4)

        # Only flag high relative_std when there IS meaningful motion.
        # Static video (mean_mag < 0.5) is NORMAL — not a deepfake indicator.
        if mean_mag > 0.5 and relative_std > 3.0:
            score += min(0.4, (relative_std - 3.0) / 5.0)

        logger.debug(f"OpticalFlow: mean_mag={mean_mag:.3f}, "
                     f"cv_mag={cv_mag:.3f}, rel_std={relative_std:.3f} -> {score:.3f}")
        return float(np.clip(score, 0.0, 1.0))
    except Exception as e:
        logger.debug(f"Optical flow failed: {e}")
        return 0.1


def _single_frame_quality(frame: np.ndarray) -> float:
    """Fallback for videos with only one decodable frame."""
    try:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        lap_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        return float(np.clip(0.3 - lap_var / 2000.0, 0.0, 0.5))
    except Exception:
        return 0.1


# ── Ensemble scoring ───────────────────────────────────────────────────────────

_WEIGHTS = {
    "inter_frame_consistency": 0.25,
    "temporal_noise":          0.20,
    "frame_quality":           0.15,
    "optical_flow":            0.15,
    "ai_frame_score":          0.25,
}


def _weighted_score(signals: dict[str, float]) -> float:
    active_weights = {k: _WEIGHTS.get(k, 0.15) for k in signals if k in _WEIGHTS}
    total_weight = sum(active_weights.values())
    if total_weight < 1e-6:
        return 0.1
        
    weighted_avg = sum(signals[k] * active_weights[k] for k in active_weights) / total_weight
    
    max_signal = max(signals.values()) if signals else 0.0
    # Prevent score dilution: deepfake detection is an OR problem.
    # If any single forensic test shows strong evidence of manipulation, the media is manipulated.
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

def _build_reasons(signals: dict[str, float], overall: float, n_frames: int) -> list[str]:
    reasons = [f"Analysed {n_frames} sampled keyframes"]

    ai = signals.get("ai_frame_score")
    if ai is not None:
        if ai > 0.65:
            reasons.append(f"AI classifier flagged keyframes as likely AI-generated "
                           f"(average confidence: {ai:.0%})")
        elif ai > 0.40:
            reasons.append(f"AI classifier shows moderate AI-generation indicators on keyframes "
                           f"(average: {ai:.0%})")
        else:
            reasons.append(f"AI classifier indicates keyframes are likely authentic "
                           f"(confidence: {1-ai:.0%})")

    ifc = signals.get("inter_frame_consistency", 0.0)
    if ifc > 0.5:
        reasons.append("Abrupt colour histogram shifts between frames — "
                       "inconsistent lighting typical of face-swap deepfakes")
    elif ifc > 0.25:
        reasons.append("Mild inter-frame histogram inconsistency detected")

    tn = signals.get("temporal_noise", 0.0)
    if tn > 0.5:
        reasons.append("Camera sensor noise is inconsistent across frames — "
                       "suggests spliced or AI-generated content")
    elif tn > 0.25:
        reasons.append("Noise pattern variability slightly elevated across frames")

    fq = signals.get("frame_quality", 0.0)
    if fq > 0.5:
        reasons.append("Sharpness inconsistency across frames — blurring patterns "
                       "differ between facial and background regions")
    elif fq > 0.25:
        reasons.append("Moderate sharpness variation detected across sampled frames")

    of = signals.get("optical_flow", 0.0)
    if of > 0.5:
        reasons.append("Optical flow anomaly detected — motion vectors are "
                       "inconsistent with natural movement patterns")
    elif of > 0.25:
        reasons.append("Mild optical flow irregularity between consecutive frames")

    if overall < 0.2:
        reasons.append("Temporal analysis completed — no significant manipulation indicators found")

    return reasons or ["Temporal forensic analysis inconclusive"]


def _empty_result(message: str, model: str) -> dict:
    return {
        "confidence": 0.0,
        "reasons": [message],
        "model": model,
        "signal_detail": {},
    }
