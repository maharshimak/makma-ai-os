from makma.config import Settings
from makma.integrations import register_http_integrations
from makma.memory import SQLiteMemory
from makma.tools import build_default_registry


def test_satellite_tools_register_only_when_configured() -> None:
    memory = SQLiteMemory(":memory:")
    registry = build_default_registry(memory)
    settings = Settings(
        database_path=":memory:",
        rag_base_url="http://rag.local",
        data_copilot_base_url="http://data.local",
        eval_base_url="http://eval.local",
        control_plane_base_url="http://control.local",
    )

    register_http_integrations(registry, settings)

    described = {item["name"]: item for item in registry.describe()}
    assert "rag_answer" in described
    assert described["rag_answer"]["side_effects"] is False
    assert "data_ask" in described
    assert described["data_ask"]["risk_level"] == "medium"
    assert described["eval_judge"]["side_effects"] is False
    assert described["mlops_models"]["side_effects"] is False
    assert described["mlops_promote_candidate"]["requires_approval"] is True
    assert described["mlops_promote_candidate"]["risk_level"] == "high"
    assert described["mlops_promote_candidate"]["side_effects"] is True
    assert described["mlops_promote_production"]["requires_approval"] is True
    memory.close()
