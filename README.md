# pyodide-bridge

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18%2F19-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![Pyodide](https://img.shields.io/badge/Pyodide-0.27-f7d336?logo=python&logoColor=white)](https://pyodide.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Generate **type-safe TypeScript bridges** from annotated Python modules for Pyodide Web Workers.
Write Python with `TypedDict` annotations, run one command, and get fully typed Workers + React Hooks -- no hand-written glue code.

## Key Characteristics

- **Zero glue code** -- a single CLI command (`pyodide-bridge gen`) generates type definitions, Web Worker, and React Hooks from your Python source
- **End-to-end type safety** -- Python `TypedDict` / `Literal` map directly to TypeScript types; every RPC call is fully typed
- **Framework-agnostic runtime** -- the core Worker bootstrap and data conversion work without React; React Hooks are an optional layer

## How It Works

```
  annotated Python module
          │
          ▼
  ┌──────────────────┐
  │ pyodide-bridge gen│   CLI (code generation)
  └──────┬───────────┘
         │
    ┌────┴────┬──────────────┐
    ▼         ▼              ▼
 .types.ts  .worker.ts   .hooks.ts
 (TS types) (Web Worker)  (React Hooks)
```

Define your Python functions with typed parameters and return values:

```python
from typing import TypedDict, Literal, Required

SurfaceKind = Literal["sphere", "torus", "trefoil_knot"]

class MeshParams(TypedDict, total=False):
    kind: Required[SurfaceKind]
    resolution: int
    scale: float

class MeshResult(TypedDict):
    positions: list[float]
    normals: list[float]
    indices: list[int]
    vertex_count: int

__bridge_exports__ = ["generate_mesh"]
__bridge_packages__ = ["numpy"]

def generate_mesh(params: MeshParams) -> MeshResult:
    ...
```

Then generate the bridge:

```bash
npx pyodide-bridge gen
```

This produces fully typed TypeScript that you use directly:

```tsx
import { useGenerateMesh, usePyodide } from "./generated/geometry.hooks";

function App() {
  const { status, api } = usePyodide<BridgeAPI>({ worker: workerUrl });
  const mesh = useGenerateMesh(api);

  // mesh.execute({ kind: "torus", resolution: 64 })
  // mesh.result  → MeshResult (fully typed)
  // mesh.isLoading, mesh.error
}
```

## Type Mapping

| Python | TypeScript |
|--------|------------|
| `str` | `string` |
| `int` / `float` | `number` |
| `bool` | `boolean` |
| `None` | `null` |
| `list[T]` | `T[]` |
| `dict[K, V]` | `Record<K, V>` |
| `TypedDict` | `type { ... }` (with optional fields) |
| `Literal["a", "b"]` | `"a" \| "b"` |
| `Optional[T]` | `T \| undefined` |

## Quick Start

```bash
npm install pyodide-bridge comlink
```

Create a config file (`pyodide-bridge.config.mjs`):

```js
export default {
  pyodideVersion: "0.27.5",
  modules: [
    { input: "python/src/my_module.py", outdir: "src/generated" },
  ],
  bundler: "vite",
  react: true,
};
```

Generate and run:

```bash
npx pyodide-bridge gen          # generate .types.ts, .worker.ts, .hooks.ts
npm run dev                     # start your app
```

## Examples

| Example | Stack | Description |
|---------|-------|-------------|
| [`examples/basic`](examples/basic) | React | Text analyzer -- word count, character frequency, summary |
| [`examples/scientific`](examples/scientific) | React + numpy + scipy + matplotlib | Signal processing with SVG chart rendering |
| [`examples/3d`](examples/3d) | React + numpy + Three.js | Parametric surface generation with WebGL rendering |

## Architecture

| Layer | Technology | Role |
|-------|-----------|------|
| CLI | Node.js + Python subprocess | Parse annotations, emit TypeScript |
| Runtime | Comlink + Pyodide CDN | Worker bootstrap, data conversion, error handling |
| React | Hooks (`usePyodide`, `createBridgeHook`) | Lifecycle management, loading / error states |

## Project Structure

```
src/
├── cli/                     # Code generation CLI
│   ├── bin.ts               # Entry point (pyodide-bridge command)
│   ├── config.ts            # Config file loader
│   ├── check.ts             # --check mode (CI validation)
│   └── emitters/            # TypeScript code emitters
│       ├── types.ts         # .types.ts generator
│       ├── worker.ts        # .worker.ts generator
│       └── hooks.ts         # .hooks.ts generator
├── runtime/                 # Browser runtime (framework-agnostic)
│   ├── worker-bootstrap.ts  # Pyodide CDN loader + package installer
│   ├── deep-convert.ts      # PyProxy → JS conversion
│   └── error.ts             # Bridge error detection
├── react/                   # React integration (optional)
│   ├── use-pyodide.ts       # Worker lifecycle hook
│   └── create-hook.ts       # Per-function hook factory
└── parser/                  # Python AST parser (subprocess)
    └── parse_module.py      # Extracts TypedDict / Literal / exports
```

## Build & Test

```bash
npm install
npm run build        # build with tsup
npm test             # run vitest (60 tests)
npm run typecheck    # tsc --noEmit
npm run format       # prettier
```

## Design Conventions

- Python modules declare `__bridge_exports__` (function list) and `__bridge_packages__` (pip dependencies) as module-level variables
- All generated files are prefixed with the module name (e.g., `science.types.ts`, `science.worker.ts`, `science.hooks.ts`)
- Runtime data conversion handles Pyodide's `Map` ↔ JS `Object` translation recursively via `deepConvertMaps()`
- CI check mode (`pyodide-bridge gen --check`) detects stale generated files without overwriting

## License

[MIT](LICENSE)
