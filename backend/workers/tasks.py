"""
Celery task definitions for TruthLens.
"""

from datetime import datetime, timezone, timedelta
from loguru import logger
from .celery_app import celery_app
from core.database import SessionLocal
from models.detection import DetectionRecord


@celery_app.task(name="cleanup_expired_records")
def cleanup_expired_records():
    """Remove detection records older than 30 days."""
    db = SessionLocal()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        deleted = db.query(DetectionRecord).filter(
            DetectionRecord.created_at < cutoff
        ).delete()
        db.commit()
        logger.info(f"Cleanup: deleted {deleted} expired records")
    except Exception as e:
        db.rollback()
        logger.error(f"Cleanup error: {e}")
    finally:
        db.close()


@celery_app.task(name="ping")
def ping():
    return "pong"
