"""Test fixture: no __bridge_exports__ defined."""

from typing import TypedDict


class MyData(TypedDict):
    value: int
    label: str


def process(data: MyData) -> str:
    return data["label"]
