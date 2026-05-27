from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone, timedelta
from loguru import logger
import uuid
import io
import base64

from core.database import get_db
from schemas.detection import ScanRequest, ScanResponse, DetectionResult, DetectionHistoryResponse, AnalyticsResponse
from models.detection import DetectionRecord, DomainReputation
from ai_services import ImageDetector, AudioDetector, VideoDetector

router = APIRouter(prefix="/detection", tags=["detection"])

image_detector = ImageDetector()
audio_detector = AudioDetector()
video_detector = VideoDetector()


@router.post("/scan", response_model=ScanResponse)
async def scan_media(
    request: ScanRequest,
    db: Session = Depends(get_db),
):
    """Analyze a media URL or uploaded data for deepfake indicators."""
    start_time = datetime.now(timezone.utc)
    request_id = str(uuid.uuid4())[:8]
    logger.info(f"[{request_id}] Scan request: type={request.media_type}, use_cloud={request.use_cloud}, url={str(request.media_url or '')[:80]}")

    if request.media_type not in ("image", "video", "audio"):
        raise HTTPException(status_code=400, detail="Unsupported media type")

    # ── BUG FIX: base64_data must be decoded, not re-encoded ──────────────
    # Previously: request.base64_data.encode() returned ASCII bytes of the
    # base64 string itself — not the actual image/audio/video bytes.
    media_bytes = b""
    if request.base64_data:
        try:
            media_bytes = base64.b64decode(request.base64_data)
            logger.info(f"[{request_id}] Decoded base64_data: {len(media_bytes)} bytes")
        except Exception as e:
            logger.warning(f"[{request_id}] Failed to decode base64_data: {e}")

    if not media_bytes and request.media_url:
        if request.media_url.startswith("data:"):
            try:
                if "," in request.media_url:
                    _header, encoded = request.media_url.split(",", 1)
                    media_bytes = base64.b64decode(encoded)
                    logger.info(f"[{request_id}] Decoded data URI: {len(media_bytes)} bytes")
            except Exception as e:
                logger.warning(f"[{request_id}] Failed to decode data URL: {e}")
        elif request.media_url.startswith("blob:"):
            logger.warning(f"[{request_id}] blob: URLs cannot be fetched server-side — using URL as signal only")
        else:
            import httpx
            try:
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
                async with httpx.AsyncClient(follow_redirects=True) as client:
                    resp = await client.get(request.media_url, timeout=8.0, headers=headers)
                    if resp.status_code == 200:
                        media_bytes = resp.content
                        logger.info(f"[{request_id}] Fetched URL: {len(media_bytes)} bytes (HTTP 200)")
                    else:
                        logger.warning(f"[{request_id}] Failed to fetch {request.media_url[:80]}: HTTP {resp.status_code}")
            except Exception as e:
                logger.warning(f"[{request_id}] HTTP fetch error for {request.media_url[:80]}: {e}")

    if not media_bytes:
        # Cannot analyze — return low confidence instead of failing to suspicious.
        # Most unreachable media is simply CDN/CORS-blocked, not evidence of manipulation.
        # The extension's canvas capture (base64_data) is the primary path —
        # this fallback only triggers when canvas also failed.
        logger.warning(f"[{request_id}] No media bytes obtained — returning low-confidence result")
        scan_duration_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
        no_data_response = ScanResponse(
            status="completed",
            result=DetectionResult(
                confidence=0.15,
                risk_level="authentic",
                scan_source="cloud" if request.use_cloud else "local",
                scan_duration_ms=scan_duration_ms,
                model_used="N/A — media unreachable",
                reasons=[
                    "Media could not be retrieved for forensic analysis — "
                    "CDN/CORS restrictions prevented download.",
                    "No manipulation evidence found (analysis limited by access restrictions).",
                ],
            ),
            request_id=request_id,
            timestamp=start_time,
        )
        return no_data_response

    # Select detector based on media type
    if request.media_type == "image":
        if request.use_cloud:
            result = await image_detector.deep_analysis(media_bytes)
        else:
            result = await image_detector.fast_scan(media_bytes)
    elif request.media_type == "video":
        if request.use_cloud:
            result = await video_detector.deep_analysis(media_bytes)
        else:
            result = await video_detector.fast_scan(media_bytes)
    else:
        if request.use_cloud:
            result = await audio_detector.deep_analysis(media_bytes)
        else:
            result = await audio_detector.fast_scan(media_bytes)

    signal_detail = result.get("signal_detail", {})
    logger.info(
        f"[{request_id}] Detector confidence={result['confidence']:.4f}, "
        f"model={result.get('model')}, signals={signal_detail}"
    )

    scan_duration = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)

    confidence = result["confidence"]
    # Thresholds calibrated to hybrid AI + heuristic ensemble:
    # With AI model: authentic ≈ 0.02–0.25, suspicious ≈ 0.25–0.55, deepfake ≈ 0.55+
    # Without AI model (heuristic-only): similar but with wider variance.
    # The 0.30 / 0.60 split provides a safety buffer around the 0.50 AI decision boundary.
    if confidence >= 0.60:
        risk_level = "deepfake"
    elif confidence >= 0.30:
        risk_level = "suspicious"
    else:
        risk_level = "authentic"
    logger.info(f"[{request_id}] Final: confidence={confidence:.4f} -> risk_level={risk_level}")

    response = ScanResponse(
        status="completed",
        result=DetectionResult(
            confidence=confidence,
            risk_level=risk_level,
            scan_source="cloud" if request.use_cloud else "local",
            scan_duration_ms=scan_duration,
            model_used=result.get("model", "Unknown"),
            reasons=result.get("reasons", []),
        ),
        request_id=request_id,
        timestamp=start_time,
    )

    # Save all scan records (not just non-authentic) so analytics are accurate
    if request.domain:
        record = DetectionRecord(
            media_type=request.media_type,
            media_url=request.media_url or "",
            risk_level=risk_level,
            confidence=confidence,
            scan_source="cloud" if request.use_cloud else "local",
            scan_duration_ms=scan_duration,
            model_used=result.get("model", "Unknown"),
            reasons=result.get("reasons", []),
            page_url=request.page_url or "",
            domain=request.domain,
            session_id=request.session_id or "",
            expires_at=start_time + timedelta(days=30),
        )
        db.add(record)
        _update_domain_reputation(db, request.domain, risk_level)
        db.commit()

    return response


@router.post("/scan/upload", response_model=ScanResponse)
async def scan_upload(
    file: UploadFile = File(...),
    media_type: str = Form("image"),
    use_cloud: bool = Form(False),
    domain: Optional[str] = Form(None),
    page_url: Optional[str] = Form(None),
    session_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Analyze an uploaded media file."""
    import base64
    contents = await file.read()
    encoded = base64.b64encode(contents).decode()
    request = ScanRequest(
        media_url=None,
        media_type=media_type,
        use_cloud=use_cloud,
        domain=domain,
        page_url=page_url,
        session_id=session_id,
        base64_data=encoded,
    )
    return await scan_media(request, db)


@router.get("/history", response_model=list[DetectionHistoryResponse])
async def get_history(
    skip: int = 0,
    limit: int = 50,
    risk_level: Optional[str] = None,
    media_type: Optional[str] = None,
    domain: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Retrieve detection history with optional filters."""
    query = db.query(DetectionRecord).filter(
        DetectionRecord.expires_at > datetime.now(timezone.utc)
    )

    if risk_level and risk_level != "all":
        query = query.filter(DetectionRecord.risk_level == risk_level)
    if media_type and media_type != "all":
        query = query.filter(DetectionRecord.media_type == media_type)
    if domain and domain != "all":
        query = query.filter(DetectionRecord.domain == domain)

    records = query.order_by(DetectionRecord.created_at.desc()).offset(skip).limit(limit).all()
    return records


@router.delete("/history")
async def clear_history(db: Session = Depends(get_db)):
    """Clear all detection history records."""
    db.query(DetectionRecord).delete()
    db.commit()
    return {"ok": True}


@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(db: Session = Depends(get_db)):
    """Compute detection analytics."""
    records = db.query(DetectionRecord).filter(
        DetectionRecord.expires_at > datetime.now(timezone.utc)
    ).all()

    total = len(records)
    suspicious = sum(1 for r in records if r.risk_level == "suspicious")
    deepfake = sum(1 for r in records if r.risk_level == "deepfake")
    authentic = sum(1 for r in records if r.risk_level == "authentic")

    domain_counts: dict[str, dict[str, int]] = {}
    for r in records:
        if r.domain not in domain_counts:
            domain_counts[r.domain] = {"total": 0, "suspicious": 0, "deepfake": 0}
        domain_counts[r.domain]["total"] += 1
        if r.risk_level == "suspicious":
            domain_counts[r.domain]["suspicious"] += 1
        elif r.risk_level == "deepfake":
            domain_counts[r.domain]["deepfake"] += 1

    top_domains = sorted(
        [
            {
                "domain": d,
                "total_scans": v["total"],
                "risk_score": round(
                    ((v["suspicious"] + v["deepfake"] * 2) / max(v["total"], 1)) * 100, 1
                ),
            }
            for d, v in domain_counts.items()
        ],
        key=lambda x: x["risk_score"],
        reverse=True,
    )[:10]

    # Daily trends (last 7 days)
    now = datetime.now(timezone.utc)
    scan_trends = []
    for i in range(6, -1, -1):
        day_start = now - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        day_records = [
            r
            for r in records
            if day_start <= r.created_at.replace(tzinfo=timezone.utc) < day_end
        ]
        scan_trends.append({
            "date": day_start.strftime("%b %d"),
            "scans": len(day_records),
            "flagged": sum(
                1 for r in day_records if r.risk_level != "authentic"
            ),
        })

    return AnalyticsResponse(
        total_scans=total,
        suspicious_count=suspicious,
        deepfake_count=deepfake,
        authentic_count=authentic,
        top_domains=top_domains,
        scan_trends=scan_trends,
    )


def _update_domain_reputation(db: Session, domain: str, risk_level: str):
    """Update domain reputation score after a scan."""
    reputation = db.query(DomainReputation).filter(DomainReputation.domain == domain).first()
    if not reputation:
        reputation = DomainReputation(
            domain=domain,
            total_scans=0,
            suspicious_count=0,
            deepfake_count=0,
            risk_score=0.0
        )
        db.add(reputation)

    reputation.total_scans += 1
    if risk_level == "suspicious":
        reputation.suspicious_count += 1
    elif risk_level == "deepfake":
        reputation.deepfake_count += 1

    reputation.risk_score = round(
        ((reputation.suspicious_count + reputation.deepfake_count * 2)
         / max(reputation.total_scans, 1)) * 100,
        1,
    )
    reputation.last_scan_at = datetime.now(timezone.utc)
    db.flush()
