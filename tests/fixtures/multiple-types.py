"""Test fixture: multiple TypedDict types and functions."""

from typing import TypedDict, Literal, Optional, NotRequired

Priority = Literal['low', 'medium', 'high']
Category = Literal['bug', 'feature', 'docs']


class UserInput(TypedDict):
    name: str
    email: str
    age: Optional[int]


class TaskInput(TypedDict):
    title: str
    description: str
    priority: Priority
    category: Category
    tags: NotRequired[list[str]]


class TaskResult(TypedDict):
    id: int
    success: bool


class SummaryResult(TypedDict):
    total: int
    items: list[dict[str, str]]


__bridge_exports__ = ['create_task', 'get_summary']
__bridge_packages__ = ['pandas', 'numpy']


def create_task(task: TaskInput) -> TaskResult:
    return {"id": 1, "success": True}


def get_summary(user: UserInput) -> SummaryResult:
    return {"total": 0, "items": []}


def _internal_helper() -> None:
    """This should NOT be exported."""
    pass
