"""
Accuracy Test Suite for TruthLens Detection Pipeline

Tests the backend with:
1. Known AI-generated images (from thispersondoesnotexist.com)
2. Known authentic images (real photos from Wikimedia, Unsplash)
3. Edge cases (unreachable URLs, synthetic images, noisy photos)
"""

import asyncio
import httpx
import base64
import json
import sys
import time
import os

# Fix Windows console encoding
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

API_BASE = "http://localhost:8000/api/v1"


async def scan_url(url: str, media_type: str = "image", use_cloud: bool = False) -> dict:
    payload = {
        "media_url": url,
        "media_type": media_type,
        "use_cloud": use_cloud,
        "domain": "test.accuracy",
        "page_url": "http://test.accuracy/test",
        "session_id": "accuracy_test",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"{API_BASE}/detection/scan", json=payload)
        return resp.json()


async def scan_bytes(image_bytes: bytes, media_type: str = "image", use_cloud: bool = False) -> dict:
    b64 = base64.b64encode(image_bytes).decode()
    payload = {
        "base64_data": b64,
        "media_type": media_type,
        "use_cloud": use_cloud,
        "domain": "test.accuracy",
        "page_url": "http://test.accuracy/test",
        "session_id": "accuracy_test",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"{API_BASE}/detection/scan", json=payload)
        return resp.json()


def print_result(label: str, data: dict, expected_risk: str = None):
    result = data.get("result", {})
    confidence = result.get("confidence", -1)
    risk = result.get("risk_level", "?")
    model = result.get("model_used", "?")
    reasons = result.get("reasons", [])

    match = ""
    if expected_risk:
        if risk == expected_risk:
            match = " [PASS]"
        else:
            match = f" [FAIL - expected {expected_risk}]"

    print(f"\n{'='*70}")
    print(f"  {label}")
    print(f"  Confidence: {confidence:.4f}  |  Risk: {risk}{match}")
    print(f"  Model: {model}")
    for r in reasons[:3]:
        print(f"    -> {r}")
    print(f"{'='*70}")
    return risk == expected_risk if expected_risk else None


async def test_with_real_images():
    results = []

    print("\n" + "=" * 70)
    print("  TruthLens Accuracy Test Suite")
    print("=" * 70)

    # -- Test 1: Known AI-generated face --
    print("\n\nTEST 1: AI-Generated Face (thispersondoesnotexist.com)")
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get("https://thispersondoesnotexist.com", headers={
                "User-Agent": "Mozilla/5.0"
            })
            if resp.status_code == 200 and len(resp.content) > 1000:
                data = await scan_bytes(resp.content, "image", use_cloud=True)
                confidence = data.get("result", {}).get("confidence", 0)
                risk = data.get("result", {}).get("risk_level", "?")
                print_result("AI-Generated Face (TPDNE)", data)
                # Should be caught by the new self-hosted AI model
                passed = risk in ("deepfake", "suspicious") and confidence > 0.60
                results.append(("AI Face (TPDNE) - caught by AI model", passed))
            else:
                print(f"  SKIP: Could not fetch image (HTTP {resp.status_code})")
                results.append(("AI Face (TPDNE)", None))
    except Exception as e:
        print(f"  SKIP: Network error: {e}")
        results.append(("AI Face (TPDNE)", None))

    # -- Test 2: Authentic painting from Wikimedia --
    print("\n\nTEST 2: Authentic Photo (Wikimedia Commons)")
    wikimedia_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/300px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg"
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(wikimedia_url, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200 and len(resp.content) > 1000:
                data = await scan_bytes(resp.content, "image", use_cloud=False)
                passed = print_result("Authentic Painting (Wikimedia)", data, "authentic")
                results.append(("Authentic Painting", passed))
            else:
                print(f"  SKIP: HTTP {resp.status_code}")
                results.append(("Authentic Painting", None))
    except Exception as e:
        print(f"  SKIP: {e}")
        results.append(("Authentic Painting", None))

    # -- Test 3: Authentic landscape from Unsplash --
    print("\n\nTEST 3: Authentic Photo (Unsplash)")
    unsplash_url = "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400"
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(unsplash_url, headers={"User-Agent": "Mozilla/5.0"})
            if resp.status_code == 200 and len(resp.content) > 1000:
                data = await scan_bytes(resp.content, "image", use_cloud=False)
                passed = print_result("Authentic Landscape (Unsplash)", data, "authentic")
                results.append(("Authentic Landscape", passed))
            else:
                print(f"  SKIP: HTTP {resp.status_code}")
                results.append(("Authentic Landscape", None))
    except Exception as e:
        print(f"  SKIP: {e}")
        results.append(("Authentic Landscape", None))

    # -- Test 4: Unreachable media (fail-safe) --
    print("\n\nTEST 4: Unreachable Media (Fail-Safe)")
    data = await scan_url("https://example.com/nonexistent-image.jpg", "image")
    passed = print_result("Unreachable Media (fail-safe)", data, "authentic")
    results.append(("Unreachable Fail-Safe", passed))

    # -- Test 5: Synthetic gradient (uniform, no noise) --
    print("\n\nTEST 5: Synthetic Gradient Image (in-memory)")
    try:
        from PIL import Image
        import io
        import numpy as np

        arr = np.zeros((256, 256, 3), dtype=np.uint8)
        for y in range(256):
            for x in range(256):
                arr[y, x] = [x, y, (x + y) // 2]
        img = Image.fromarray(arr)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        data = await scan_bytes(buf.getvalue(), "image", use_cloud=False)
        print_result("Synthetic Gradient Image", data)
        confidence = data.get("result", {}).get("confidence", 0)
        # Synthetic gradient should have elevated signals
        results.append(("Synthetic Gradient", confidence > 0.10))
    except ImportError:
        print("  SKIP: Pillow not available")
        results.append(("Synthetic Gradient", None))

    # -- Test 6: Natural noisy photo (should be authentic) --
    print("\n\nTEST 6: Noisy Natural Photo (in-memory)")
    try:
        from PIL import Image
        import io
        import numpy as np

        np.random.seed(42)
        arr = np.random.randint(60, 200, (512, 512, 3), dtype=np.uint8)
        for y in range(0, 512, 64):
            for x in range(0, 512, 64):
                color = np.random.randint(30, 220, 3, dtype=np.uint8)
                arr[y:y+64, x:x+64] = arr[y:y+64, x:x+64] // 2 + color // 2
        img = Image.fromarray(arr)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        data = await scan_bytes(buf.getvalue(), "image", use_cloud=False)
        passed = print_result("Noisy Natural Photo", data, "authentic")
        results.append(("Noisy Photo", passed))
    except ImportError:
        print("  SKIP: Pillow not available")
        results.append(("Noisy Photo", None))

    # -- Test 7: Solid color image (suspicious metadata) --
    print("\n\nTEST 7: Solid Color Image (suspicious)")
    try:
        from PIL import Image
        import io

        img = Image.new("RGB", (512, 512), (128, 0, 255))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        data = await scan_bytes(buf.getvalue(), "image", use_cloud=False)
        print_result("Solid Color Image", data)
        confidence = data.get("result", {}).get("confidence", 0)
        # Solid color should have high color stats anomaly
        results.append(("Solid Color", confidence > 0.15))
    except ImportError:
        results.append(("Solid Color", None))

    # -- Summary --
    print("\n\n" + "=" * 70)
    print("  ACCURACY SUMMARY")
    print("=" * 70)
    total = len(results)
    passed_count = sum(1 for _, p in results if p is True)
    failed_count = sum(1 for _, p in results if p is False)
    skipped_count = sum(1 for _, p in results if p is None)

    for name, result in results:
        if result is True:
            status = "[PASS]"
        elif result is False:
            status = "[FAIL]"
        else:
            status = "[SKIP]"
        print(f"  {status}  {name}")

    print(f"\n  Total: {total}  |  Passed: {passed_count}  |  Failed: {failed_count}  |  Skipped: {skipped_count}")
    print("=" * 70 + "\n")

    return failed_count == 0


if __name__ == "__main__":
    success = asyncio.run(test_with_real_images())
    sys.exit(0 if success else 1)
