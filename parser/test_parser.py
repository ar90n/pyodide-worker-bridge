"""Tests for the pyodide-bridge Python parser."""

import json
import os
import subprocess
import sys

import pytest

PARSER_PATH = os.path.join(os.path.dirname(__file__), "parser.py")
FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "..", "tests", "fixtures")


def run_parser(fixture_name: str) -> dict:
    """Run parser.py on a fixture file and return parsed JSON."""
    fixture_path = os.path.join(FIXTURES_DIR, fixture_name)
    result = subprocess.run(
        [sys.executable, PARSER_PATH, fixture_path],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"Parser failed: {result.stderr}"
    return json.loads(result.stdout)


def run_parser_expect_error(fixture_name: str) -> str:
    """Run parser.py on a fixture file and expect failure."""
    fixture_path = os.path.join(FIXTURES_DIR, fixture_name)
    result = subprocess.run(
        [sys.executable, PARSER_PATH, fixture_path],
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0, "Parser should have failed"
    return result.stderr


# ============================================================
# simple.py
# ============================================================


class TestSimpleFixture:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.ir = run_parser("simple.py")

    def test_module_name(self) -> None:
        assert self.ir["moduleName"] == "simple"

    def test_literal_type(self) -> None:
        status = next(t for t in self.ir["types"] if t["name"] == "Status")
        assert status["kind"] == "literal"
        assert status["values"] == ["ok", "error"]

    def test_typeddict_total_false(self) -> None:
        input_params = next(t for t in self.ir["types"] if t["name"] == "InputParams")
        assert input_params["kind"] == "typeddict"
        assert input_params["total"] is False
        # query is Required[str] in total=False -> required=True
        query_field = next(f for f in input_params["fields"] if f["name"] == "query")
        assert query_field["required"] is True
        assert query_field["type"] == {"kind": "primitive", "name": "str"}
        # limit is plain int in total=False -> required=False
        limit_field = next(f for f in input_params["fields"] if f["name"] == "limit")
        assert limit_field["required"] is False
        assert limit_field["type"] == {"kind": "primitive", "name": "int"}

    def test_typeddict_total_true(self) -> None:
        result = next(t for t in self.ir["types"] if t["name"] == "Result")
        assert result["kind"] == "typeddict"
        assert result["total"] is True
        # data: list[float]
        data_field = next(f for f in result["fields"] if f["name"] == "data")
        assert data_field["required"] is True
        assert data_field["type"] == {
            "kind": "list",
            "element": {"kind": "primitive", "name": "float"},
        }
        # status: Status (reference)
        status_field = next(f for f in result["fields"] if f["name"] == "status")
        assert status_field["type"] == {"kind": "reference", "name": "Status"}

    def test_exported_function(self) -> None:
        assert len(self.ir["functions"]) == 1
        func = self.ir["functions"][0]
        assert func["name"] == "run_query"
        assert len(func["params"]) == 1
        assert func["params"][0]["name"] == "params"
        assert func["params"][0]["type"] == {"kind": "reference", "name": "InputParams"}
        assert func["returnType"] == {"kind": "reference", "name": "Result"}

    def test_packages(self) -> None:
        assert self.ir["packages"] == ["numpy"]


# ============================================================
# multiple-types.py
# ============================================================


class TestMultipleTypesFixture:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.ir = run_parser("multiple-types.py")

    def test_literal_types(self) -> None:
        priority = next(t for t in self.ir["types"] if t["name"] == "Priority")
        assert priority["values"] == ["low", "medium", "high"]
        category = next(t for t in self.ir["types"] if t["name"] == "Category")
        assert category["values"] == ["bug", "feature", "docs"]

    def test_optional_field(self) -> None:
        user = next(t for t in self.ir["types"] if t["name"] == "UserInput")
        age_field = next(f for f in user["fields"] if f["name"] == "age")
        assert age_field["type"] == {
            "kind": "optional",
            "inner": {"kind": "primitive", "name": "int"},
        }

    def test_not_required_field(self) -> None:
        task = next(t for t in self.ir["types"] if t["name"] == "TaskInput")
        tags_field = next(f for f in task["fields"] if f["name"] == "tags")
        assert tags_field["required"] is False
        assert tags_field["type"] == {
            "kind": "list",
            "element": {"kind": "primitive", "name": "str"},
        }

    def test_only_exported_functions(self) -> None:
        names = [f["name"] for f in self.ir["functions"]]
        assert "create_task" in names
        assert "get_summary" in names
        assert "_internal_helper" not in names

    def test_packages(self) -> None:
        assert self.ir["packages"] == ["pandas", "numpy"]


# ============================================================
# literal-types.py
# ============================================================


class TestLiteralTypesFixture:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.ir = run_parser("literal-types.py")

    def test_string_literal(self) -> None:
        color = next(t for t in self.ir["types"] if t["name"] == "Color")
        assert color["values"] == ["red", "green", "blue"]

    def test_int_literal(self) -> None:
        count = next(t for t in self.ir["types"] if t["name"] == "Count")
        assert count["values"] == [1, 2, 3, 5, 8]

    def test_bool_literal(self) -> None:
        flag = next(t for t in self.ir["types"] if t["name"] == "Flag")
        assert flag["values"] == [True, False]


# ============================================================
# no-exports.py
# ============================================================


class TestNoExportsFixture:
    @pytest.fixture(autouse=True)
    def setup(self) -> None:
        self.ir = run_parser("no-exports.py")

    def test_no_functions_exported(self) -> None:
        assert self.ir["functions"] == []

    def test_types_still_parsed(self) -> None:
        assert len(self.ir["types"]) == 1
        assert self.ir["types"][0]["name"] == "MyData"

    def test_no_packages(self) -> None:
        assert self.ir["packages"] == []


# ============================================================
# syntax-error.py
# ============================================================


class TestSyntaxErrorFixture:
    def test_parser_fails(self) -> None:
        stderr = run_parser_expect_error("syntax-error.py")
        assert "Syntax error" in stderr or "Error" in stderr
