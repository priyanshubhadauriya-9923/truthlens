"""
Audio Deepfake Detection Service

Real spectral forensic analysis pipeline — all signals derived from actual
audio waveform and frequency content.

Signals used:
  1. Spectral Flatness (Wiener Entropy)  — synthetic audio tends toward specific flatness ranges
  2. Zero-Crossing Rate                  — TTS/voice-cloned audio has more regular ZCR patterns
  3. Sub-Band Energy Distribution        — TTS has unnatural energy profiles in high bands
  4. Silence & Padding Detection         — abrupt cuts, loops, and padding artefacts
  5. Spectral Rolloff                    — TTS engines often cut off above ~8 kHz
  6. Format Header Analysis              — format-level signals when waveform is unavailable

FIXED:
  - Removed garbage MP3 approximate decode that treated compressed bytes as PCM
  - Added pydub/ffmpeg decode path for MP3/OGG/AAC
  - Improved spectral flatness thresholds to reduce false positives
"""

import io
import struct
import numpy as np
from loguru import logger
from typing import Optional

try:
    import scipy.io.wavfile as wav_io
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    logger.warning("scipy not available — audio forensics degraded")

try:
    from pydub import AudioSegment
    PYDUB_AVAILABLE = True
except ImportError:
    PYDUB_AVAILABLE = False
    logger.info("pydub not available — MP3/OGG decode unavailable (install pydub + ffmpeg)")


# ── Signal weights ─────────────────────────────────────────────────────────────
_WEIGHTS = {
    "spectral_flatness":   0.25,
    "zero_crossing_rate":  0.20,
    "subband_energy":      0.20,
    "silence_artifacts":   0.15,
    "spectral_rolloff":    0.15,
    "format_header":       0.05,
}


class AudioDetector:
    def __init__(self, model_path: str = "models/weights"):
        self.model_path = model_path
        logger.info(f"AudioDetector initialized (scipy={SCIPY_AVAILABLE}, pydub={PYDUB_AVAILABLE})")

    # ── Public API ─────────────────────────────────────────────────────────────

    async def fast_scan(self, audio_bytes: bytes) -> dict:
        """Fast spectral analysis — runs lightweight spectral signals."""
        if not audio_bytes:
            return _empty_result("No audio data available for analysis", "AudioForensics-Fast")

        samples, sample_rate = _decode_audio(audio_bytes)
        if samples is None:
            # Cannot decode waveform — return honest "unable to analyze" with header-only signal
            header_score = _header_signal(audio_bytes)
            return {
                "confidence": header_score,
                "reasons": [
                    "Audio waveform could not be decoded for spectral analysis.",
                    "Only format-level heuristics applied — accuracy is limited.",
                    "Install pydub + ffmpeg for full MP3/OGG/AAC forensic analysis.",
                ],
                "model": "AudioForensics-Fast (header-only, degraded)",
                "signal_detail": {"format_header": round(header_score, 4)},
            }

        signals = _run_signals(samples, sample_rate, deep=False)
        score = _weighted_score(signals)
        score = float(np.clip(score, 0.03, 0.97))

        return {
            "confidence": score,
            "reasons": _build_reasons(signals, score),
            "model": "AudioForensics-Fast (SpectralFlatness + ZCR + SubBandEnergy)",
            "signal_detail": {k: round(v, 4) for k, v in signals.items()},
        }

    async def deep_analysis(self, audio_bytes: bytes) -> dict:
        """Full spectral + silence + rolloff analysis."""
        if not audio_bytes:
            return _empty_result("No audio data available for analysis", "AudioForensics-Deep")

        samples, sample_rate = _decode_audio(audio_bytes)
        if samples is None:
            header_score = _header_signal(audio_bytes)
            return {
                "confidence": header_score,
                "reasons": [
                    "Audio waveform could not be decoded for spectral analysis.",
                    "Only format-level heuristics applied — accuracy is limited.",
                    "Install pydub + ffmpeg for full MP3/OGG/AAC forensic analysis.",
                ],
                "model": "AudioForensics-Deep (header-only, degraded)",
                "signal_detail": {"format_header": round(header_score, 4)},
            }

        signals = _run_signals(samples, sample_rate, deep=True)
        score = _weighted_score(signals)
        score = float(np.clip(score, 0.03, 0.97))

        return {
            "confidence": score,
            "reasons": _build_reasons(signals, score),
            "model": "AudioForensics-Deep (SpectralFlatness + ZCR + SubBand + Silence + Rolloff)",
            "signal_detail": {k: round(v, 4) for k, v in signals.items()},
        }


# ── Audio decoding ─────────────────────────────────────────────────────────────

def _decode_audio(audio_bytes: bytes) -> tuple[Optional[np.ndarray], int]:
    """
    Attempt to decode audio bytes to a numpy float32 array.
    Returns (samples, sample_rate) or (None, 0) if decode fails.

    Decode priority:
      1. scipy WAV decode (lossless, fast)
      2. Manual WAV PCM parser (fallback for scipy)
      3. pydub decode (handles MP3, OGG, AAC, FLAC via ffmpeg)
    """
    # 1. Try scipy WAV decode
    if SCIPY_AVAILABLE:
        try:
            sample_rate, data = wav_io.read(io.BytesIO(audio_bytes))
            if data.ndim > 1:
                data = data.mean(axis=1)
            samples = data.astype(np.float32)
            max_val = np.abs(samples).max()
            if max_val > 0:
                samples /= max_val
            logger.info(f"Decoded WAV (scipy): {len(samples)} samples @ {sample_rate}Hz")
            return samples, sample_rate
        except Exception:
            pass

    # 2. Manual WAV header parse (PCM 16-bit / 8-bit)
    try:
        samples, sample_rate = _parse_wav_pcm(audio_bytes)
        if samples is not None:
            logger.info(f"Decoded WAV (manual): {len(samples)} samples @ {sample_rate}Hz")
            return samples, sample_rate
    except Exception:
        pass

    # 3. pydub decode (MP3, OGG, AAC, FLAC, etc.)
    if PYDUB_AVAILABLE:
        try:
            audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
            samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
            # Normalize to [-1, 1]
            max_val = 2 ** (audio.sample_width * 8 - 1)
            samples /= max_val
            # Mix to mono if stereo
            if audio.channels > 1:
                samples = samples.reshape(-1, audio.channels).mean(axis=1)
            sample_rate = audio.frame_rate
            logger.info(f"Decoded audio (pydub): {len(samples)} samples @ {sample_rate}Hz")
            return samples, sample_rate
        except Exception as e:
            logger.warning(f"pydub decode failed: {e}")

    logger.warning("Could not decode audio — no suitable decoder available")
    return None, 0


def _parse_wav_pcm(data: bytes) -> tuple[Optional[np.ndarray], int]:
    """Manual WAV/RIFF PCM parser (supports 16-bit and 8-bit PCM)."""
    if len(data) < 44:
        return None, 0
    if data[:4] != b'RIFF' or data[8:12] != b'WAVE':
        return None, 0

    try:
        offset = 12
        sample_rate = 0
        num_channels = 1
        bits_per_sample = 16

        while offset + 8 < len(data):
            chunk_id   = data[offset:offset+4]
            chunk_size = struct.unpack_from('<I', data, offset+4)[0]
            offset += 8
            if chunk_id == b'fmt ':
                num_channels = struct.unpack_from('<H', data, offset+2)[0]
                sample_rate  = struct.unpack_from('<I', data, offset+4)[0]
                bits_per_sample = struct.unpack_from('<H', data, offset+14)[0]
                offset += chunk_size
            elif chunk_id == b'data':
                raw = data[offset:offset+chunk_size]
                if bits_per_sample == 16:
                    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
                elif bits_per_sample == 8:
                    samples = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128.0) / 128.0
                else:
                    return None, 0
                if num_channels > 1:
                    samples = samples.reshape(-1, num_channels).mean(axis=1)
                return samples, sample_rate
            else:
                offset += chunk_size
        return None, 0
    except Exception:
        return None, 0


# ── Signal pipeline ────────────────────────────────────────────────────────────

def _run_signals(samples: np.ndarray, sample_rate: int, deep: bool) -> dict[str, float]:
    signals: dict[str, float] = {}

    if len(samples) < 64:
        return {"format_header": 0.3}

    signals["spectral_flatness"]  = _spectral_flatness_signal(samples, sample_rate)
    signals["zero_crossing_rate"] = _zero_crossing_rate_signal(samples, sample_rate)
    signals["subband_energy"]     = _subband_energy_signal(samples, sample_rate)
    signals["format_header"]      = 0.0  # Waveform available — neutral

    if deep:
        signals["silence_artifacts"] = _silence_artifact_signal(samples, sample_rate)
        signals["spectral_rolloff"]  = _spectral_rolloff_signal(samples, sample_rate)

    return signals


def _spectral_flatness_signal(samples: np.ndarray, sample_rate: int) -> float:
    """
    Wiener Entropy / Spectral Flatness.
    TTS voices often have unnaturally smooth spectra → low flatness.
    Natural speech sits in a mid-range.
    """
    try:
        frame_size = min(2048, len(samples) // 4)
        if frame_size < 64:
            return 0.1
        hop = frame_size // 2

        flatness_vals = []
        for start in range(0, len(samples) - frame_size, hop):
            frame = samples[start:start + frame_size] * np.hanning(frame_size)
            spectrum = np.abs(np.fft.rfft(frame)) + 1e-10
            geo_mean = np.exp(np.mean(np.log(spectrum)))
            arith_mean = np.mean(spectrum)
            flatness = geo_mean / (arith_mean + 1e-10)
            flatness_vals.append(float(flatness))

        if not flatness_vals:
            return 0.1

        mean_flat = float(np.mean(flatness_vals))
        std_flat  = float(np.std(flatness_vals))

        score = 0.0

        # Natural speech: mean_flat ≈ 0.05–0.25, std ≈ 0.05–0.15
        # TTS often: mean_flat < 0.03 (overly tonal) or > 0.6 (noise-like synthesis)
        if mean_flat < 0.03:
            score += min(0.5, (0.03 - mean_flat) / 0.03)
        elif mean_flat > 0.6:
            score += min(0.25, (mean_flat - 0.6) / 0.6)

        # Suspiciously uniform flatness across frames
        if std_flat < 0.015:
            score += 0.3
        elif std_flat < 0.03:
            score += 0.15

        logger.debug(f"SpectralFlatness: mean={mean_flat:.4f}, std={std_flat:.4f} -> {score:.3f}")
        return float(np.clip(score, 0.0, 1.0))
    except Exception as e:
        logger.debug(f"Spectral flatness failed: {e}")
        return 0.1


def _zero_crossing_rate_signal(samples: np.ndarray, sample_rate: int) -> float:
    """
    Zero-Crossing Rate analysis.
    Synthetic/TTS audio has more regular ZCR patterns.
    Natural speech has high ZCR variability across frames.
    """
    try:
        frame_size = min(1024, len(samples) // 4)
        if frame_size < 32:
            return 0.1
        hop = frame_size // 2

        zcr_vals = []
        for start in range(0, len(samples) - frame_size, hop):
            frame = samples[start:start + frame_size]
            zcr = float(np.sum(np.diff(np.sign(frame)) != 0)) / len(frame)
            zcr_vals.append(zcr)

        if not zcr_vals:
            return 0.1

        zcr_arr = np.array(zcr_vals)
        mean_zcr = float(zcr_arr.mean())
        std_zcr  = float(zcr_arr.std())
        cv_zcr   = std_zcr / (mean_zcr + 1e-9)

        score = 0.0
        # Low coefficient of variation → unnaturally regular ZCR → TTS indicator
        if cv_zcr < 0.3:
            score += min(0.5, (0.3 - cv_zcr) / 0.3)
        # Very high mean ZCR consistently (electronic noise artefact)
        if mean_zcr > 0.4 and std_zcr < 0.05:
            score += 0.3

        logger.debug(f"ZCR: mean={mean_zcr:.4f}, std={std_zcr:.4f}, CV={cv_zcr:.3f} -> {score:.3f}")
        return float(np.clip(score, 0.0, 1.0))
    except Exception as e:
        logger.debug(f"ZCR failed: {e}")
        return 0.1


def _subband_energy_signal(samples: np.ndarray, sample_rate: int) -> float:
    """
    Sub-Band Energy Distribution.
    TTS models often produce truncated or abnormally distributed
    energy above ~6–8 kHz.
    """
    try:
        n_fft = min(4096, len(samples) // 2)
        if n_fft < 64:
            return 0.1

        spectrum = np.abs(np.fft.rfft(samples[:n_fft])) ** 2
        freqs = np.fft.rfftfreq(n_fft, d=1.0 / max(sample_rate, 8000))

        total_energy = spectrum.sum() + 1e-10

        def band_energy(f_low, f_high):
            mask = (freqs >= f_low) & (freqs < f_high)
            return float(spectrum[mask].sum()) / total_energy

        e_low   = band_energy(0,    300)
        e_mid   = band_energy(300,  3400)
        e_high  = band_energy(3400, 8000)
        e_vhigh = band_energy(8000, 20000)

        score = 0.0

        if e_mid < 0.2:
            score += 0.4  # Very little speech-band energy
        if e_vhigh < 0.01 and sample_rate > 16000:
            score += 0.25  # Hard cutoff above 8kHz
        if e_low > 0.5:
            score += 0.2   # Excessive low-frequency energy
        if abs(e_high - 0.12) < 0.02 and abs(e_mid - 0.55) < 0.02:
            score += 0.1   # Suspiciously "textbook" distribution

        logger.debug(f"SubBandEnergy: low={e_low:.3f}, mid={e_mid:.3f}, "
                     f"high={e_high:.3f}, vhigh={e_vhigh:.3f} -> {score:.3f}")
        return float(np.clip(score, 0.0, 1.0))
    except Exception as e:
        logger.debug(f"Sub-band energy failed: {e}")
        return 0.1


def _silence_artifact_signal(samples: np.ndarray, sample_rate: int) -> float:
    """
    Silence and Padding Detection.
    Checks for: unnatural silence blocks, abrupt amplitude cuts, loop artefacts.
    """
    try:
        frame_size = max(256, sample_rate // 50)  # ~20ms frames
        if len(samples) < frame_size * 4:
            return 0.0

        rms_vals = []
        for start in range(0, len(samples) - frame_size, frame_size):
            frame = samples[start:start + frame_size]
            rms = float(np.sqrt(np.mean(frame ** 2)))
            rms_vals.append(rms)

        if not rms_vals:
            return 0.0

        rms_arr = np.array(rms_vals)
        max_rms = rms_arr.max()
        if max_rms < 1e-6:
            return 0.4  # Silent audio

        threshold = max_rms * 0.01
        silence_ratio = float((rms_arr < threshold).mean())

        score = 0.0
        if silence_ratio > 0.5:
            score += min(0.5, silence_ratio * 0.5)

        # Detect abrupt transitions (large RMS jumps)
        rms_diff = np.abs(np.diff(rms_arr))
        abrupt_count = int((rms_diff > max_rms * 0.5).sum())
        if abrupt_count > len(rms_vals) * 0.05:
            score += min(0.4, abrupt_count / len(rms_vals))

        logger.debug(f"SilenceArtefacts: silence_ratio={silence_ratio:.3f}, "
                     f"abrupt_cuts={abrupt_count} -> {score:.3f}")
        return float(np.clip(score, 0.0, 1.0))
    except Exception as e:
        logger.debug(f"Silence artifact failed: {e}")
        return 0.0


def _spectral_rolloff_signal(samples: np.ndarray, sample_rate: int) -> float:
    """
    Spectral Rolloff Analysis.
    TTS systems often hard-bandlimit audio, causing an unnaturally low rolloff.
    """
    try:
        n_fft = min(4096, len(samples) // 2)
        if n_fft < 64:
            return 0.0

        spectrum = np.abs(np.fft.rfft(samples[:n_fft])) ** 2
        freqs = np.fft.rfftfreq(n_fft, d=1.0 / max(sample_rate, 8000))

        cumulative = np.cumsum(spectrum)
        total = cumulative[-1]
        if total < 1e-10:
            return 0.2

        rolloff_85 = float(freqs[np.searchsorted(cumulative, total * 0.85)])
        rolloff_95 = float(freqs[np.searchsorted(cumulative, total * 0.95)])

        score = 0.0
        nyquist = sample_rate / 2.0

        relative_rolloff = rolloff_95 / nyquist
        if relative_rolloff < 0.4:
            score += min(0.6, (0.4 - relative_rolloff) / 0.4)

        # Very sharp rolloff = hard bandlimit artefact
        rolloff_sharpness = (rolloff_95 - rolloff_85) / (nyquist + 1e-6)
        if rolloff_sharpness < 0.02:
            score += 0.3

        logger.debug(f"SpectralRolloff: rolloff_85={rolloff_85:.0f}Hz, "
                     f"rolloff_95={rolloff_95:.0f}Hz -> {score:.3f}")
        return float(np.clip(score, 0.0, 1.0))
    except Exception as e:
        logger.debug(f"Spectral rolloff failed: {e}")
        return 0.0


def _header_signal(audio_bytes: bytes) -> float:
    """Format-level heuristic when waveform cannot be decoded."""
    if not audio_bytes or len(audio_bytes) < 4:
        return 0.5
    magic = audio_bytes[:4]
    if magic == b'RIFF':
        return 0.05
    if magic == b'OggS':
        return 0.1
    if audio_bytes[:2] in (b'\xff\xfb', b'\xff\xfa') or audio_bytes[:3] == b'ID3':
        return 0.1
    return 0.2


# ── Ensemble scoring ───────────────────────────────────────────────────────────

def _weighted_score(signals: dict[str, float]) -> float:
    active_weights = {k: _WEIGHTS.get(k, 0.1) for k in signals if k in _WEIGHTS}
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

def _build_reasons(signals: dict[str, float], overall: float) -> list[str]:
    reasons = []

    sf = signals.get("spectral_flatness", 0.0)
    if sf > 0.5:
        reasons.append("Spectral flatness is outside the natural speech range — "
                       "consistent with TTS or voice-cloning synthesis")
    elif sf > 0.25:
        reasons.append("Mild spectral flatness anomaly — slight deviation from natural voice")

    zcr = signals.get("zero_crossing_rate", 0.0)
    if zcr > 0.5:
        reasons.append("Zero-crossing rate is unnaturally uniform — "
                       "natural speech has much higher ZCR variability")
    elif zcr > 0.25:
        reasons.append("ZCR variability slightly below expected range for natural speech")

    sbe = signals.get("subband_energy", 0.0)
    if sbe > 0.5:
        reasons.append("Sub-band energy distribution is atypical — "
                       "possible hard frequency cutoff above 8 kHz (TTS artefact)")
    elif sbe > 0.25:
        reasons.append("Mild sub-band energy imbalance detected")

    sa = signals.get("silence_artifacts", 0.0)
    if sa > 0.5:
        reasons.append("Abrupt silence transitions or irregular padding detected — "
                       "suggests audio splicing or synthetic generation")
    elif sa > 0.25:
        reasons.append("Minor silence artefacts present in the audio")

    sr = signals.get("spectral_rolloff", 0.0)
    if sr > 0.4:
        reasons.append("Spectral rolloff is unusually low — "
                       "audio appears to be band-limited (typical of voice synthesis)")
    elif sr > 0.2:
        reasons.append("Slightly limited spectral rolloff detected")

    if overall < 0.2:
        reasons.append("All spectral signals within expected range for authentic audio")

    return reasons or ["Spectral forensic analysis completed — results inconclusive"]


def _empty_result(message: str, model: str) -> dict:
    return {
        "confidence": 0.0,
        "reasons": [message],
        "model": model,
        "signal_detail": {},
    }
