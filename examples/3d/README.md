# 3D Geometry Example

**numpy mesh generation → Three.js WebGL rendering**

This example demonstrates the "compute in Python, render in JavaScript" pattern using pyodide-bridge.
Python (numpy) generates parametric surface meshes (vertices, normals, face indices), and the main thread renders them with Three.js.

## Surfaces

| Surface          | Description                                |
| ---------------- | ------------------------------------------ |
| **Sphere**       | Unit sphere via spherical coordinates      |
| **Torus**        | Torus with configurable inner radius ratio |
| **Trefoil Knot** | Tube surface along a trefoil knot curve    |

## Quick Start

```bash
npm install
npm run generate   # generate bridge files from geometry.py
npm run dev        # start Vite dev server
```

## How It Works

```
[Worker / Pyodide]                 [Main Thread]

  geometry.py (numpy)               App.tsx (React + Three.js)
    generate_mesh(params)    →       useGenerateMesh hook
    returns:                         receives MeshResult:
      positions: float[]               → Float32BufferAttribute
      normals:   float[]               → Float32BufferAttribute
      indices:   int[]                  → BufferGeometry.setIndex()
                                     Three.js renders with WebGL
```

## Key Files

| File                        | Purpose                                      |
| --------------------------- | -------------------------------------------- |
| `python/src/geometry.py`    | Parametric surface generation with numpy     |
| `src/App.tsx`               | React UI + Three.js scene setup              |
| `src/generated/`            | Auto-generated bridge (types, worker, hooks) |
| `pyodide-bridge.config.mjs` | Bridge configuration                         |

## Architecture Pattern

Since WebGL contexts cannot be accessed from Web Workers, this example uses the recommended architecture:

1. **Python (Worker)**: Heavy computation — vertex positions, normals, triangle indices via numpy
2. **TypeScript (Main Thread)**: WebGL rendering — `BufferGeometry` construction, `MeshPhongMaterial`, `OrbitControls`

Data is transferred as flat `number[]` arrays via Comlink RPC, then converted to `Float32Array` / `Uint32Array` for Three.js.
