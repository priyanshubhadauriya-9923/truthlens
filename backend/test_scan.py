"""Quick functional test of the scan endpoint."""
import httpx
import asyncio
import base64
import json
from PIL import Image
import io
import numpy as np

BASE = "http://127.0.0.1:8000/api/v1"


async def test_health():
    async with httpx.AsyncClient() as c:
        r = await c.get(f"{BASE}/health")
        print(f"Health: {r.json()}")


async def test_scan_synthetic_image():
    """Create a synthetic solid-color image (unusual for a real photo) and scan it."""
    img = Image.new("RGB", (512, 512), color=(128, 128, 128))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    img_bytes = buf.getvalue()
    b64 = base64.b64encode(img_bytes).decode()

    payload = {
        "media_type": "image",
        "use_cloud": False,
        "base64_data": b64,
        "domain": "test.com",
    }
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{BASE}/detection/scan", json=payload, timeout=30)
        result = r.json()
        print(f"\n=== Synthetic solid-color image (should be SUSPICIOUS) ===")
        print(f"Status: {result['status']}")
        print(f"Confidence: {result['result']['confidence']:.4f}")
        print(f"Risk Level: {result['result']['risk_level']}")
        print(f"Reasons: {json.dumps(result['result']['reasons'], indent=2)}")
        print(f"Model: {result['result']['model_used']}")


async def test_scan_natural_image():
    """Create a noisy gradient image simulating a natural photo."""
    np.random.seed(42)
    # Create a gradient with natural noise
    h, w = 800, 600
    gradient = np.linspace(30, 220, w).reshape(1, -1).repeat(h, axis=0)
    noise = np.random.normal(0, 8, (h, w))
    r = np.clip(gradient + noise + np.random.normal(0, 3, (h, w)), 0, 255).astype(np.uint8)
    g = np.clip(gradient * 0.8 + noise + np.random.normal(0, 3, (h, w)), 0, 255).astype(np.uint8)
    b = np.clip(gradient * 0.6 + noise + np.random.normal(0, 3, (h, w)), 0, 255).astype(np.uint8)

    img_arr = np.stack([r, g, b], axis=2)
    img = Image.fromarray(img_arr, "RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    img_bytes = buf.getvalue()
    b64 = base64.b64encode(img_bytes).decode()

    payload = {
        "media_type": "image",
        "use_cloud": False,
        "base64_data": b64,
        "domain": "test.com",
    }
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{BASE}/detection/scan", json=payload, timeout=30)
        result = r.json()
        print(f"\n=== Natural gradient+noise image (should be AUTHENTIC) ===")
        print(f"Status: {result['status']}")
        print(f"Confidence: {result['result']['confidence']:.4f}")
        print(f"Risk Level: {result['result']['risk_level']}")
        print(f"Reasons: {json.dumps(result['result']['reasons'], indent=2)}")


async def test_scan_known_deepfake_url():
    """Test with a known AI-generated face from thispersondoesnotexist."""
    payload = {
        "media_url": "https://thispersondoesnotexist.com",
        "media_type": "image",
        "use_cloud": False,
        "domain": "thispersondoesnotexist.com",
    }
    async with httpx.AsyncClient() as c:
        r = await c.post(f"{BASE}/detection/scan", json=payload, timeout=30)
        result = r.json()
        print(f"\n=== AI-generated face (thispersondoesnotexist.com) ===")
        print(f"Status: {result['status']}")
        print(f"Confidence: {result['result']['confidence']:.4f}")
        print(f"Risk Level: {result['result']['risk_level']}")
        print(f"Reasons: {json.dumps(result['result']['reasons'], indent=2)}")


async def main():
    await test_health()
    await test_scan_synthetic_image()
    await test_scan_natural_image()
    await test_scan_known_deepfake_url()
    print("\n✅ All tests completed")


if __name__ == "__main__":
    asyncio.run(main())
