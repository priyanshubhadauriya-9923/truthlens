import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app


@pytest.fixture
def client():
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_scan_image_url(client):
    response = await client.post(
        "/api/v1/detection/scan",
        json={
            "media_url": "https://example.com/photo.jpg",
            "media_type": "image",
            "domain": "example.com",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert "confidence" in data["result"]


@pytest.mark.asyncio
async def test_invalid_media_type(client):
    response = await client.post(
        "/api/v1/detection/scan",
        json={
            "media_url": "https://example.com/file.pdf",
            "media_type": "document",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_analytics(client):
    response = await client.get("/api/v1/detection/analytics")
    assert response.status_code == 200
    data = response.json()
    assert "total_scans" in data
