from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ScanRequest(BaseModel):
    media_url: Optional[str] = None
    media_type: str  # image, video, audio
    session_id: Optional[str] = None
    page_url: Optional[str] = None
    domain: Optional[str] = None
    use_cloud: bool = False
    base64_data: Optional[str] = None


class DetectionResult(BaseModel):
    confidence: float
    risk_level: str
    scan_source: str
    scan_duration_ms: int
    model_used: str
    reasons: list[str]


class ScanResponse(BaseModel):
    status: str
    result: DetectionResult
    request_id: str
    timestamp: datetime


class DetectionHistoryResponse(BaseModel):
    id: int
    media_type: str
    risk_level: str
    confidence: float
    domain: str
    model_used: str
    reasons: list[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AnalyticsResponse(BaseModel):
    total_scans: int
    suspicious_count: int
    deepfake_count: int
    authentic_count: int
    top_domains: list[dict]
    scan_trends: list[dict]
