from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, func
from core.database import Base


class DetectionRecord(Base):
    __tablename__ = "detection_records"

    id = Column(Integer, primary_key=True, index=True)
    media_type = Column(String(20))  # image, video, audio
    media_url = Column(String(2048))
    risk_level = Column(String(20))  # authentic, suspicious, deepfake
    confidence = Column(Float)
    scan_source = Column(String(20))  # local, cloud, hybrid
    scan_duration_ms = Column(Integer)
    model_used = Column(String(100))
    reasons = Column(JSON)
    page_url = Column(String(2048))
    domain = Column(String(255))
    session_id = Column(String(100))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True))


class DomainReputation(Base):
    __tablename__ = "domain_reputations"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(255), unique=True, index=True)
    total_scans = Column(Integer, default=0)
    suspicious_count = Column(Integer, default=0)
    deepfake_count = Column(Integer, default=0)
    risk_score = Column(Float, default=0.0)
    last_scan_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
