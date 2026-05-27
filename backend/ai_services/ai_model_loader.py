"""
AI Model Loader — Local Inference Integration

Provides a real AI-based deepfake/AI-generated-image classifier using the
local Transformers library. This is the **primary detection signal** for
image analysis (weight ≈ 0.50 in the ensemble).

Local model:  Organika/sdxl-detector (ViT-based, highly accurate for diffusion)
Fallback:     Returns None so the caller can fall back to heuristics-only
              if transformers fails to load or inference fails.
"""

import os
import io
import asyncio
from typing import Optional
from loguru import logger

try:
    from transformers import pipeline
    from PIL import Image
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

# ── Configuration ──────────────────────────────────────────────────────────────

# Primary model — ViT-based real-vs-AI detector specifically trained on diffusion artifacts
HF_IMAGE_MODEL = "Organika/sdxl-detector"


class AIModelClassifier:
    """
    Wraps a local Hugging Face Transformers pipeline for binary AI-image classification.
    Returns P(AI-generated) as a float in [0, 1], or None if unavailable.
    """

    def __init__(self):
        self._available = bool(TRANSFORMERS_AVAILABLE)
        self.classifier = None
        self._loading = False
        
        if self._available:
            logger.info(f"AIModelClassifier ready to load locally (model={HF_IMAGE_MODEL})")
        else:
            logger.warning("AIModelClassifier unavailable (transformers/PIL not installed) — heuristic-only mode")

    @property
    def available(self) -> bool:
        return self._available

    def _load_model_sync(self):
        """Synchronously load the model (run in a thread to avoid blocking)."""
        if self.classifier is None:
            logger.info(f"Loading local Transformers pipeline for {HF_IMAGE_MODEL}...")
            self.classifier = pipeline("image-classification", model=HF_IMAGE_MODEL)
            logger.info("Local Transformers pipeline loaded successfully.")

    def _predict_sync(self, image_bytes: bytes) -> Optional[float]:
        """Synchronous prediction wrapper (run in thread)."""
        try:
            self._load_model_sync()
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            results = self.classifier(img)
            return self._parse_response(results)
        except Exception as e:
            logger.warning(f"Local AI Model inference error: {e}")
            return None

    async def predict(self, image_bytes: bytes) -> Optional[float]:
        """
        Run image bytes through the local Transformers model in a thread pool.

        Returns:
            float in [0, 1] — probability the image is AI-generated, or
            None if inference failed / is unavailable.
        """
        if not self._available or not image_bytes:
            return None

        # Run inference in a separate thread so we don't block the FastAPI event loop
        return await asyncio.to_thread(self._predict_sync, image_bytes)

    def _parse_response(self, results: list) -> Optional[float]:
        """
        Parse the Transformers pipeline image-classification response.

        The pipeline returns a list like:
            [{"label": "real", "score": 0.08},
             {"label": "fake", "score": 0.92}]

        We extract the "artificial" / "ai" / "fake" score.
        """
        if not isinstance(results, list):
            return None

        # Flatten nested lists (some models return [[...]])
        if results and isinstance(results[0], list):
            results = results[0]

        ai_score = None
        human_score = None

        for item in results:
            if not isinstance(item, dict):
                continue
            label = item.get("label", "").lower()
            score = float(item.get("score", 0.0))

            if label in ("artificial", "ai", "fake", "ai-generated", "synthetic", "label_1"):
                ai_score = score
            elif label in ("human", "real", "authentic", "natural", "label_0"):
                human_score = score

        if ai_score is not None:
            return ai_score
        if human_score is not None:
            return 1.0 - human_score

        # If labels don't match expected names, use the first result
        # and assume it's the positive class if score > 0.5
        if results and isinstance(results[0], dict):
            return float(results[0].get("score", 0.5))

        return None


# ── Module-level singleton ─────────────────────────────────────────────────────
_classifier = AIModelClassifier()


def get_classifier() -> AIModelClassifier:
    """Return the module-level classifier singleton."""
    return _classifier

