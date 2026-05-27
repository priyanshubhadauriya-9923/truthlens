"""Quick test to check deepfake scoring for known AI-generated images."""
import asyncio
import httpx
import base64
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
API_BASE = "http://localhost:8000/api/v1"


async def scan_bytes(image_bytes, use_cloud=True):
    b64 = base64.b64encode(image_bytes).decode()
    payload = {
        "base64_data": b64,
        "media_type": "image",
        "use_cloud": use_cloud,
        "domain": "test",
        "page_url": "http://test/test",
        "session_id": "test",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"{API_BASE}/detection/scan", json=payload)
        return resp.json()


def show(label, data):
    r = data.get("result", {})
    conf = r.get("confidence", -1)
    risk = r.get("risk_level", "?")
    model = r.get("model_used", "?")
    print(f"\n{'='*70}")
    print(f"  {label}")
    print(f"  Confidence: {conf:.4f}  |  Risk: {risk}")
    print(f"  Model: {model}")
    for reason in r.get("reasons", [])[:5]:
        print(f"    -> {reason}")
    # Show signal detail
    signal_detail = r.get("signal_detail", {})
    if not signal_detail:
        # Try from the raw data
        pass
    print(f"{'='*70}")
    return conf, risk


async def main():
    print("Fetching AI-generated face from thispersondoesnotexist.com...")
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            "https://thispersondoesnotexist.com",
            headers={"User-Agent": "Mozilla/5.0"},
        )
    if resp.status_code != 200 or len(resp.content) < 1000:
        print(f"SKIP: HTTP {resp.status_code}")
        return

    face_bytes = resp.content
    print(f"Got {len(face_bytes)} bytes")

    # Deep analysis (cloud)
    data1 = await scan_bytes(face_bytes, use_cloud=True)
    conf1, risk1 = show("AI Face - Deep Analysis (use_cloud=True)", data1)

    # Fast scan (local only)
    data2 = await scan_bytes(face_bytes, use_cloud=False)
    conf2, risk2 = show("AI Face - Fast Scan (use_cloud=False)", data2)

    print(f"\n\nSummary:")
    print(f"  Deep:  conf={conf1:.4f}  risk={risk1}  (want: >= 0.60 / deepfake)")
    print(f"  Fast:  conf={conf2:.4f}  risk={risk2}  (want: >= 0.30 / suspicious+)")

    # Now test with a known deepfake URL that has obvious indicators
    print("\n\nFetching a second AI face...")
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp2 = await client.get(
            "https://thispersondoesnotexist.com",
            headers={"User-Agent": "Mozilla/5.0"},
        )
    if resp2.status_code == 200 and len(resp2.content) > 1000:
        data3 = await scan_bytes(resp2.content, use_cloud=True)
        show("Second AI Face - Deep Analysis", data3)


asyncio.run(main())
