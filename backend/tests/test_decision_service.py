from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from mini_ise import decision_service
from mini_ise.db import SEED_POLICIES
from mini_ise.decision_service import State, app
from mini_ise.rules import Policy

REQUEST = {
    "user": "lena.contractor",
    "device_id": "len-200",
    "role": "contractor",
    "resource": "finance",
    "location": "remote",
    "device_managed": True,
    "device_encrypted": True,
    "device_patched": True,
    "hour": 14,
}


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setattr(decision_service, "state", State())
    # No `with` block: the lifespan (database loops) doesn't run in unit tests.
    yield TestClient(app)


def load_seed_policies() -> None:
    decision_service.state.policies = [Policy(id=i + 1, **p.model_dump()) for i, p in enumerate(SEED_POLICIES)]
    decision_service.state.loaded_at = 1.0


def test_fails_closed_before_policies_load(client: TestClient) -> None:
    response = client.post("/v1/decide", json=REQUEST)
    assert response.status_code == 200
    assert response.json()["effect"] == "deny"
    assert client.get("/readyz").status_code == 503


def test_decides_from_loaded_policies_and_buffers_log_row(client: TestClient) -> None:
    load_seed_policies()
    body = client.post("/v1/decide", json=REQUEST).json()
    assert body["effect"] == "deny"
    assert body["reason"] == "Contractors cannot access finance or HR"
    assert body["served_by"] == decision_service.POD_NAME
    assert len(decision_service.state.pending) == 1
    assert client.get("/readyz").json()["ready"] is True


def test_rejects_malformed_request(client: TestClient) -> None:
    load_seed_policies()
    response = client.post("/v1/decide", json={**REQUEST, "role": "ceo"})
    assert response.status_code == 422
    assert not decision_service.state.pending
