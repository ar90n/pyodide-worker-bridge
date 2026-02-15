"""Simple test fixture: basic TypedDict, Literal, and function."""

from typing import TypedDict, Literal, Required

Status = Literal['ok', 'error']


class InputParams(TypedDict, total=False):
    query: Required[str]
    limit: int


class Result(TypedDict):
    data: list[float]
    status: Status


__bridge_exports__ = ['run_query']
__bridge_packages__ = ['numpy']


def run_query(params: InputParams) -> Result:
    return {"data": [1.0, 2.0], "status": "ok"}
