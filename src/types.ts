/**
 * Module Intermediate Representation (IR)
 *
 * The central data structure of the pyodide-bridge pipeline.
 * Python Parser outputs this as JSON, and each Emitter consumes it.
 */
export interface ModuleIR {
  moduleName: string;
  types: TypeNode[];
  functions: FunctionNode[];
  packages: string[];
}

// ---------------------------------------------------------------------------
// Type Nodes
// ---------------------------------------------------------------------------

export type TypeNode = TypeDictNode | LiteralAliasNode;

export interface TypeDictNode {
  kind: "typeddict";
  name: string;
  total: boolean;
  fields: FieldNode[];
}

export interface FieldNode {
  name: string;
  type: TypeRef;
  required: boolean;
}

export interface LiteralAliasNode {
  kind: "literal";
  name: string;
  values: (string | number | boolean)[];
}

// ---------------------------------------------------------------------------
// Function Nodes
// ---------------------------------------------------------------------------

export interface FunctionNode {
  name: string;
  params: FunctionParam[];
  returnType: TypeRef;
}

export interface FunctionParam {
  name: string;
  type: TypeRef;
}

// ---------------------------------------------------------------------------
// Type References
// ---------------------------------------------------------------------------

export type TypeRef =
  | PrimitiveTypeRef
  | ListTypeRef
  | DictTypeRef
  | OptionalTypeRef
  | LiteralTypeRef
  | ReferenceTypeRef;

export interface PrimitiveTypeRef {
  kind: "primitive";
  name: "int" | "float" | "str" | "bool" | "None";
}

export interface ListTypeRef {
  kind: "list";
  element: TypeRef;
}

export interface DictTypeRef {
  kind: "dict";
  key: TypeRef;
  value: TypeRef;
}

export interface OptionalTypeRef {
  kind: "optional";
  inner: TypeRef;
}

export interface LiteralTypeRef {
  kind: "literal";
  values: (string | number | boolean)[];
}

export interface ReferenceTypeRef {
  kind: "reference";
  name: string;
}
