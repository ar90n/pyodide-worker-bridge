"""Test fixture: various Literal type patterns."""

from typing import TypedDict, Literal

Color = Literal['red', 'green', 'blue']
Size = Literal['small', 'medium', 'large']
Count = Literal[1, 2, 3, 5, 8]
Flag = Literal[True, False]


class Config(TypedDict):
    color: Color
    size: Size
    count: int
    enabled: bool


__bridge_exports__ = ['apply_config']
__bridge_packages__ = []


def apply_config(config: Config) -> bool:
    return True
