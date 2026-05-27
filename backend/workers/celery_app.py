"""
Celery worker configuration for TruthLens async tasks.
Handles:
- Deep analysis jobs
- Monthly cleanup
- Batch processing
"""

from celery import Celery
from core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "truthlens",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
    task_soft_time_limit=240,
    worker_max_tasks_per_child=100,
)
