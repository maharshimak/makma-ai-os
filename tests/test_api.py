from fastapi.testclient import TestClient

from makma.api import create_app
from makma.config import Settings
from makma.memory import SQLiteMemory
from makma.providers import LocalProvider
from makma.runtime import MakmaRuntime
from makma.tools import PermissionPolicy, build_default_registry


def build_test_client() -> TestClient:
    settings = Settings(database_path=":memory:", provider="local")
    memory = SQLiteMemory(":memory:")
    registry = build_default_registry(memory)
    runtime = MakmaRuntime(
        settings=settings,
        memory=memory,
        provider=LocalProvider(),
        registry=registry,
        policy=PermissionPolicy(allowed_tools=frozenset(registry.names)),
    )
    return TestClient(create_app(runtime))


def test_health_exposes_runtime_capabilities() -> None:
    client = build_test_client()
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["provider"] == "local"
    assert "calculator" in payload["tools"]


def test_chat_returns_plan_trace_and_tool_results() -> None:
    client = build_test_client()
    response = client.post(
        "/v1/chat",
        json={"message": "calculate 9 * 9", "session_id": "demo"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert "81" in payload["response"]
    assert payload["plan"][0]["tool_name"] == "calculator"
    assert payload["tool_results"][0]["ok"] is True


def test_history_endpoint_reads_persisted_conversation() -> None:
    client = build_test_client()
    client.post("/v1/chat", json={"message": "hello", "session_id": "history-demo"})
    response = client.get("/v1/sessions/history-demo/history")
    assert response.status_code == 200
    assert [item["role"] for item in response.json()] == ["user", "assistant"]


def test_recall_endpoint_returns_ranked_matches() -> None:
    client = build_test_client()
    client.post(
        "/v1/chat",
        json={
            "message": "project atlas budget is 500 euros",
            "session_id": "recall-api",
            "tools_enabled": False,
        },
    )
    response = client.get(
        "/v1/sessions/recall-api/recall",
        params={"q": "project atlas budget"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload
    assert "score" in payload[0]
    assert payload[0]["content"] == "project atlas budget is 500 euros"


def test_telemetry_endpoint_exposes_runtime_measurements() -> None:
    client = build_test_client()
    client.post("/v1/chat", json={"message": "calculate 4 * 5", "session_id": "metrics"})
    response = client.get("/v1/telemetry", params={"operation": "runtime.run"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["operation"] == "runtime.run"
    assert payload["count"] == 1
    assert payload["successes"] == 1


def test_github_pages_origin_is_allowed_by_cors() -> None:
    client = build_test_client()
    response = client.options(
        "/v1/chat",
        headers={
            "Origin": "https://maharshimak.github.io",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://maharshimak.github.io"
