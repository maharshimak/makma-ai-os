import pytest

from makma.tools import calculator


@pytest.mark.asyncio
async def test_calculator_rejects_booleans_and_obeys_precedence():
    with pytest.raises(ValueError):
        await calculator({"expression": "True + 1"}, "test")
    assert (await calculator({"expression": "-2**2"}, "test")).endswith("= -4")
    assert (await calculator({"expression": "2**3**2"}, "test")).endswith("= 512")
