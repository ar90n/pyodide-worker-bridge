"""
3D parametric surface mesh generator.

Generates vertex positions, normals, and face indices for parametric surfaces
using numpy. Results are returned as flat arrays suitable for Three.js BufferGeometry.

Bridge metadata:
    __bridge_exports__  — functions exposed to TypeScript
    __bridge_packages__ — Python packages to install via micropip
"""

from typing import Literal, TypedDict, Required
import numpy as np
from numpy.typing import NDArray

# ---------------------------------------------------------------------------
# Type definitions for the bridge
# ---------------------------------------------------------------------------

SurfaceKind = Literal["sphere", "torus", "trefoil_knot"]


class MeshParams(TypedDict, total=False):
    """Parameters for mesh generation."""

    kind: Required[SurfaceKind]
    resolution: int  # grid subdivisions per axis (default 64)
    scale: float  # uniform scale factor (default 1.0)
    param: float  # surface-specific parameter (default 0.4)


class MeshResult(TypedDict):
    """Flat arrays for Three.js BufferGeometry."""

    positions: list[float]  # [x,y,z, x,y,z, ...] (vertex_count * 3)
    normals: list[float]  # [nx,ny,nz, ...] (vertex_count * 3)
    indices: list[int]  # triangle face indices (face_count * 3)
    vertex_count: int
    face_count: int
    kind: str


# ---------------------------------------------------------------------------
# Bridge metadata
# ---------------------------------------------------------------------------

__bridge_exports__ = ["generate_mesh"]
__bridge_packages__ = ["numpy"]


# ---------------------------------------------------------------------------
# Surface generators
# ---------------------------------------------------------------------------


def _make_sphere(
    res: int, scale: float, _param: float
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Unit sphere parametric surface."""
    u = np.linspace(0, 2 * np.pi, res)
    v = np.linspace(0, np.pi, res)
    U, V = np.meshgrid(u, v)

    x = scale * np.cos(U) * np.sin(V)
    y = scale * np.cos(V)
    z = scale * np.sin(U) * np.sin(V)

    # Normals = normalised position for a unit sphere
    positions = np.stack([x, y, z], axis=-1)  # (res, res, 3)
    normals = positions / (np.linalg.norm(positions, axis=-1, keepdims=True) + 1e-12)
    return positions, normals


def _make_torus(
    res: int, scale: float, param: float
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Torus with major radius 1 and minor radius *param*."""
    R = scale
    r = scale * param
    u = np.linspace(0, 2 * np.pi, res)
    v = np.linspace(0, 2 * np.pi, res)
    U, V = np.meshgrid(u, v)

    x = (R + r * np.cos(V)) * np.cos(U)
    y = r * np.sin(V)
    z = (R + r * np.cos(V)) * np.sin(U)

    # Analytic normals for torus
    nx = np.cos(V) * np.cos(U)
    ny = np.sin(V)
    nz = np.cos(V) * np.sin(U)
    normals = np.stack([nx, ny, nz], axis=-1)
    normals /= np.linalg.norm(normals, axis=-1, keepdims=True) + 1e-12

    positions = np.stack([x, y, z], axis=-1)
    return positions, normals


def _make_trefoil_knot(
    res: int, scale: float, param: float
) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
    """Trefoil knot tube surface."""
    tube_radius = scale * param

    u = np.linspace(0, 2 * np.pi, res)
    v = np.linspace(0, 2 * np.pi, res)
    U, V = np.meshgrid(u, v)

    # Trefoil knot curve
    cx = scale * (np.sin(U) + 2 * np.sin(2 * U))
    cy = scale * (np.cos(U) - 2 * np.cos(2 * U))
    cz = scale * (-np.sin(3 * U))

    # Tangent (derivative of curve)
    tx = scale * (np.cos(U) + 4 * np.cos(2 * U))
    ty = scale * (-np.sin(U) + 4 * np.sin(2 * U))
    tz = scale * (-3 * np.cos(3 * U))
    t_len = np.sqrt(tx**2 + ty**2 + tz**2) + 1e-12
    tx /= t_len
    ty /= t_len
    tz /= t_len

    # Build local frame (Frenet-like)
    # Choose an arbitrary vector not parallel to tangent
    ax = np.zeros_like(tx)
    ay = np.ones_like(ty)
    az = np.zeros_like(tz)

    # Normal = tangent x arbitrary
    nx = ty * az - tz * ay
    ny = tz * ax - tx * az
    nz = tx * ay - ty * ax
    n_len = np.sqrt(nx**2 + ny**2 + nz**2) + 1e-12
    nx /= n_len
    ny /= n_len
    nz /= n_len

    # Binormal = tangent x normal
    bx = ty * nz - tz * ny
    by = tz * nx - tx * nz
    bz = tx * ny - ty * nx

    # Tube surface
    x = cx + tube_radius * (np.cos(V) * nx + np.sin(V) * bx)
    y = cy + tube_radius * (np.cos(V) * ny + np.sin(V) * by)
    z = cz + tube_radius * (np.cos(V) * nz + np.sin(V) * bz)

    # Surface normals (pointing outward from tube)
    snx = np.cos(V) * nx + np.sin(V) * bx
    sny = np.cos(V) * ny + np.sin(V) * by
    snz = np.cos(V) * nz + np.sin(V) * bz
    s_len = np.sqrt(snx**2 + sny**2 + snz**2) + 1e-12
    snx /= s_len
    sny /= s_len
    snz /= s_len

    positions = np.stack([x, y, z], axis=-1)
    normals = np.stack([snx, sny, snz], axis=-1)
    return positions, normals


# ---------------------------------------------------------------------------
# Triangulation helper
# ---------------------------------------------------------------------------


def _triangulate_grid(res: int) -> NDArray[np.int32]:
    """Generate triangle indices for a (res x res) grid."""
    indices = []
    for i in range(res - 1):
        for j in range(res - 1):
            a = i * res + j
            b = a + 1
            c = a + res
            d = c + 1
            indices.extend([a, c, b, b, c, d])
    return np.array(indices, dtype=np.int32)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_GENERATORS = {
    "sphere": _make_sphere,
    "torus": _make_torus,
    "trefoil_knot": _make_trefoil_knot,
}


def generate_mesh(params: MeshParams) -> MeshResult:
    """Generate a 3D parametric surface mesh.

    Returns flat arrays of positions, normals and triangle indices
    suitable for Three.js BufferGeometry.
    """
    kind: SurfaceKind = params["kind"]
    resolution: int = params.get("resolution", 64)
    scale: float = params.get("scale", 1.0)
    param: float = params.get("param", 0.4)

    generator = _GENERATORS[kind]
    positions, normals = generator(resolution, scale, param)

    # Flatten from (res, res, 3) to (res*res*3,)
    flat_pos = positions.reshape(-1).tolist()
    flat_nrm = normals.reshape(-1).tolist()
    flat_idx = _triangulate_grid(resolution).tolist()

    vertex_count = resolution * resolution
    face_count = len(flat_idx) // 3

    return MeshResult(
        positions=flat_pos,
        normals=flat_nrm,
        indices=flat_idx,
        vertex_count=vertex_count,
        face_count=face_count,
        kind=kind,
    )
