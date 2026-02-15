#!/usr/bin/env python3
"""pyodide-bridge Python AST parser.

Parses an annotated Python module and outputs a Module IR as JSON to stdout.
This script uses only the Python standard library.

Usage:
    python3 parser.py <input.py>
"""

from __future__ import annotations

import ast
import json
import os
import sys
from typing import Any


def parse_module(source: str, module_name: str) -> dict[str, Any]:
    """Parse a Python source string and return the Module IR as a dict."""
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        raise ParserError(f"Syntax error at line {e.lineno}: {e.msg}") from e

    ctx = ParseContext(module_name)
    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.ClassDef):
            _parse_class(node, ctx)
        elif isinstance(node, ast.Assign):
            _parse_assignment(node, ctx)
        elif isinstance(node, ast.AnnAssign):
            _parse_ann_assign(node, ctx)
        elif isinstance(node, ast.FunctionDef):
            _parse_function(node, ctx)

    # Filter functions to only those in __bridge_exports__
    exported_functions = []
    for func in ctx.functions:
        if func["name"] in ctx.bridge_exports:
            exported_functions.append(func)

    return {
        "moduleName": module_name,
        "types": ctx.types,
        "functions": exported_functions,
        "packages": ctx.bridge_packages,
    }


class ParserError(Exception):
    """Error raised during parsing."""
    pass


class ParseContext:
    """Accumulates parsed information from the module."""

    def __init__(self, module_name: str) -> None:
        self.module_name = module_name
        self.types: list[dict[str, Any]] = []
        self.functions: list[dict[str, Any]] = []
        self.bridge_exports: list[str] = []
        self.bridge_packages: list[str] = []
        self.literal_aliases: dict[str, list[Any]] = {}  # name -> values


def _parse_class(node: ast.ClassDef, ctx: ParseContext) -> None:
    """Parse a class definition, looking for TypedDict subclasses."""
    is_typed_dict = False
    total = True  # default for TypedDict

    for base in node.bases:
        if _get_name(base) == "TypedDict":
            is_typed_dict = True

    if not is_typed_dict:
        return

    # Check keywords for total=False
    for kw in node.keywords:
        if kw.arg == "total":
            if isinstance(kw.value, ast.Constant):
                total = bool(kw.value.value)

    fields: list[dict[str, Any]] = []
    for stmt in node.body:
        if isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name):
            field_name = stmt.target.id
            type_ref, is_required_wrapper, is_not_required_wrapper = _resolve_type_with_required(
                stmt.annotation
            )

            # Determine if the field is required
            if is_required_wrapper:
                required = True
            elif is_not_required_wrapper:
                required = False
            else:
                required = total  # follows the class-level total flag

            fields.append({
                "name": field_name,
                "type": type_ref,
                "required": required,
            })

    ctx.types.append({
        "kind": "typeddict",
        "name": node.name,
        "total": total,
        "fields": fields,
    })


def _parse_assignment(node: ast.Assign, ctx: ParseContext) -> None:
    """Parse a simple assignment (Literal aliases, __bridge_exports__, __bridge_packages__)."""
    if len(node.targets) != 1:
        return

    target = node.targets[0]
    if not isinstance(target, ast.Name):
        return

    name = target.id

    if name == "__bridge_exports__":
        ctx.bridge_exports = _extract_string_list(node.value)
        return

    if name == "__bridge_packages__":
        ctx.bridge_packages = _extract_string_list(node.value)
        return

    # Check for Literal type alias: Foo = Literal['a', 'b']
    if isinstance(node.value, ast.Subscript):
        base_name = _get_name(node.value.value)
        if base_name == "Literal":
            values = _extract_literal_values(node.value.slice)
            ctx.types.append({
                "kind": "literal",
                "name": name,
                "values": values,
            })
            ctx.literal_aliases[name] = values


def _parse_ann_assign(node: ast.AnnAssign, ctx: ParseContext) -> None:
    """Parse annotated assignment for TypeAlias patterns."""
    # Handle: Foo: TypeAlias = Literal['a', 'b']
    if (
        isinstance(node.target, ast.Name)
        and node.value is not None
        and isinstance(node.value, ast.Subscript)
    ):
        base_name = _get_name(node.value.value)
        if base_name == "Literal":
            name = node.target.id
            values = _extract_literal_values(node.value.slice)
            ctx.types.append({
                "kind": "literal",
                "name": name,
                "values": values,
            })
            ctx.literal_aliases[name] = values


def _parse_function(node: ast.FunctionDef, ctx: ParseContext) -> None:
    """Parse a function definition and extract its signature."""
    params: list[dict[str, Any]] = []
    for arg in node.args.args:
        if arg.arg == "self":
            continue
        if arg.annotation is None:
            continue
        param_type = _resolve_type(arg.annotation)
        params.append({
            "name": arg.arg,
            "type": param_type,
        })

    return_type: dict[str, Any]
    if node.returns is not None:
        return_type = _resolve_type(node.returns)
    else:
        return_type = {"kind": "primitive", "name": "None"}

    ctx.functions.append({
        "name": node.name,
        "params": params,
        "returnType": return_type,
    })


# ---------------------------------------------------------------------------
# Type resolution helpers
# ---------------------------------------------------------------------------

def _resolve_type(node: ast.expr) -> dict[str, Any]:
    """Resolve a type annotation AST node to a TypeRef dict."""
    ref, _, _ = _resolve_type_with_required(node)
    return ref


def _resolve_type_with_required(
    node: ast.expr,
) -> tuple[dict[str, Any], bool, bool]:
    """Resolve a type annotation, also detecting Required/NotRequired wrappers.

    Returns:
        (type_ref, is_required, is_not_required)
    """
    is_required = False
    is_not_required = False

    if isinstance(node, ast.Subscript):
        base_name = _get_name(node.value)

        if base_name == "Required":
            is_required = True
            inner = _resolve_type(_subscript_inner(node))
            return inner, True, False

        if base_name == "NotRequired":
            is_not_required = True
            inner = _resolve_type(_subscript_inner(node))
            return inner, False, True

        if base_name == "Optional":
            inner = _resolve_type(_subscript_inner(node))
            return {"kind": "optional", "inner": inner}, False, False

        if base_name == "list":
            element = _resolve_type(_subscript_inner(node))
            return {"kind": "list", "element": element}, False, False

        if base_name == "dict":
            slice_node = node.slice
            if isinstance(slice_node, ast.Tuple) and len(slice_node.elts) == 2:
                key = _resolve_type(slice_node.elts[0])
                value = _resolve_type(slice_node.elts[1])
            else:
                key = {"kind": "primitive", "name": "str"}
                value = {"kind": "primitive", "name": "str"}
            return {"kind": "dict", "key": key, "value": value}, False, False

        if base_name == "Literal":
            values = _extract_literal_values(node.slice)
            return {"kind": "literal", "values": values}, False, False

        if base_name in ("List",):
            element = _resolve_type(_subscript_inner(node))
            return {"kind": "list", "element": element}, False, False

        if base_name in ("Dict",):
            slice_node = node.slice
            if isinstance(slice_node, ast.Tuple) and len(slice_node.elts) == 2:
                key = _resolve_type(slice_node.elts[0])
                value = _resolve_type(slice_node.elts[1])
            else:
                key = {"kind": "primitive", "name": "str"}
                value = {"kind": "primitive", "name": "str"}
            return {"kind": "dict", "key": key, "value": value}, False, False

        # Union via X | Y is handled as BinOp below
        # Fallback: treat as reference
        return {"kind": "reference", "name": base_name}, False, False

    if isinstance(node, ast.Name):
        name = node.id
        primitives = {"int", "float", "str", "bool", "None"}
        if name in primitives:
            return {"kind": "primitive", "name": name}, False, False
        return {"kind": "reference", "name": name}, False, False

    if isinstance(node, ast.Constant):
        if node.value is None:
            return {"kind": "primitive", "name": "None"}, False, False

    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitOr):
        # X | Y  -> treat as Optional if one side is None
        left = _resolve_type(node.left)
        right = _resolve_type(node.right)
        if right == {"kind": "primitive", "name": "None"}:
            return {"kind": "optional", "inner": left}, False, False
        if left == {"kind": "primitive", "name": "None"}:
            return {"kind": "optional", "inner": right}, False, False
        # Generic union not fully supported; return left side
        return left, False, False

    # Fallback
    return {"kind": "primitive", "name": "str"}, False, False


def _subscript_inner(node: ast.Subscript) -> ast.expr:
    """Get the inner type of a Subscript node (e.g., list[T] -> T)."""
    return node.slice


def _get_name(node: ast.expr) -> str:
    """Extract a simple name from a Name or Attribute node."""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return ""


def _extract_string_list(node: ast.expr) -> list[str]:
    """Extract a list of strings from a List node."""
    if isinstance(node, ast.List):
        result: list[str] = []
        for elt in node.elts:
            if isinstance(elt, ast.Constant) and isinstance(elt.value, str):
                result.append(elt.value)
        return result
    return []


def _extract_literal_values(node: ast.expr) -> list[str | int | float | bool]:
    """Extract literal values from a Literal subscript."""
    values: list[str | int | float | bool] = []
    if isinstance(node, ast.Tuple):
        for elt in node.elts:
            if isinstance(elt, ast.Constant):
                values.append(elt.value)
    elif isinstance(node, ast.Constant):
        values.append(node.value)
    return values


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: parser.py <input.py>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]

    if not os.path.isfile(input_path):
        print(f"Error: file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    with open(input_path, encoding="utf-8") as f:
        source = f.read()

    module_name = os.path.splitext(os.path.basename(input_path))[0]

    try:
        ir = parse_module(source, module_name)
    except ParserError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    json.dump(ir, sys.stdout, indent=2, ensure_ascii=False)
    print()  # trailing newline


if __name__ == "__main__":
    main()
