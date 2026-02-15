import { useState, useRef, useEffect, useCallback } from "react";
import { usePyodide, useGenerateMesh } from "./generated/geometry.hooks";
import type { SurfaceKind, MeshResult } from "./generated/geometry.types";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./App.css";

// ---------------------------------------------------------------------------
// Three.js scene helper
// ---------------------------------------------------------------------------

interface SceneRefs {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  mesh: THREE.Mesh | null;
  wireHelper: THREE.LineSegments | null;
  frameId: number;
}

function initScene(canvas: HTMLCanvasElement): SceneRefs {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x111318);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(2.5, 1.8, 2.5);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);

  // Lights
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(3, 4, 5);
  scene.add(dirLight);

  const ambLight = new THREE.AmbientLight(0x404060, 0.6);
  scene.add(ambLight);

  const hemiLight = new THREE.HemisphereLight(0x6366f1, 0x1a1d27, 0.4);
  scene.add(hemiLight);

  // Grid helper
  const grid = new THREE.GridHelper(6, 12, 0x2a2d3a, 0x1e2030);
  scene.add(grid);

  const frameId = 0;

  return { renderer, scene, camera, controls, mesh: null, wireHelper: null, frameId };
}

function updateGeometry(refs: SceneRefs, data: MeshResult, wireframe: boolean, color: number) {
  // Remove old mesh
  if (refs.mesh) {
    refs.scene.remove(refs.mesh);
    refs.mesh.geometry.dispose();
    (refs.mesh.material as THREE.Material).dispose();
    refs.mesh = null;
  }
  if (refs.wireHelper) {
    refs.scene.remove(refs.wireHelper);
    refs.wireHelper.geometry.dispose();
    (refs.wireHelper.material as THREE.Material).dispose();
    refs.wireHelper = null;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
  geometry.setIndex(data.indices);

  const material = new THREE.MeshPhongMaterial({
    color,
    shininess: 60,
    side: THREE.DoubleSide,
    transparent: wireframe,
    opacity: wireframe ? 0.25 : 1.0,
  });

  const mesh = new THREE.Mesh(geometry, material);
  refs.scene.add(mesh);
  refs.mesh = mesh;

  if (wireframe) {
    const wireGeo = new THREE.WireframeGeometry(geometry);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x818cf8,
      linewidth: 1,
    });
    const lines = new THREE.LineSegments(wireGeo, wireMat);
    refs.scene.add(lines);
    refs.wireHelper = lines;
  }
}

// ---------------------------------------------------------------------------
// Surface colors
// ---------------------------------------------------------------------------

const SURFACE_COLORS: Record<SurfaceKind, number> = {
  sphere: 0x6366f1,
  torus: 0x22c55e,
  trefoil_knot: 0xf59e0b,
};

const SURFACE_LABELS: Record<SurfaceKind, string> = {
  sphere: "Sphere",
  torus: "Torus",
  trefoil_knot: "Trefoil Knot",
};

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
  const {
    status,
    error: pyErr,
    api,
    retry,
  } = usePyodide<import("./generated/geometry.worker").BridgeAPI>({
    worker: new URL("./generated/geometry.worker.ts", import.meta.url).href,
  });

  const gen = useGenerateMesh(api);

  // UI state
  const [kind, setKind] = useState<SurfaceKind>("torus");
  const [resolution, setResolution] = useState(64);
  const [scale, setScale] = useState(1.0);
  const [param, setParam] = useState(0.4);
  const [wireframe, setWireframe] = useState(false);

  // Three.js refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneRefs | null>(null);
  const meshDataRef = useRef<MeshResult | null>(null);

  // Initialize Three.js scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const refs = initScene(canvas);
    sceneRef.current = refs;

    // Resize handler
    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    const { renderer, camera, controls } = refs;
    handleResize();
    window.addEventListener("resize", handleResize);

    // Also observe parent resize (sidebar toggle etc.)
    const observer = new ResizeObserver(handleResize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    // Render loop
    const animate = () => {
      refs.frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(refs.scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(refs.frameId);
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  // Generate mesh
  const handleGenerate = useCallback(async () => {
    await gen.execute({ kind, resolution, scale, param });
  }, [gen, kind, resolution, scale, param]);

  // Apply mesh data to Three.js when result arrives
  useEffect(() => {
    if (gen.result && gen.result !== meshDataRef.current) {
      meshDataRef.current = gen.result;
      if (sceneRef.current) {
        updateGeometry(sceneRef.current, gen.result, wireframe, SURFACE_COLORS[kind]);
      }
    }
  }, [gen.result, wireframe, kind]);

  // Re-apply wireframe toggle without regenerating
  useEffect(() => {
    const data = meshDataRef.current;
    if (data && sceneRef.current) {
      updateGeometry(sceneRef.current, data, wireframe, SURFACE_COLORS[kind]);
    }
  }, [wireframe]);

  return (
    <div className="app">
      <header className="header">
        <h1>pyodide-bridge 3D example</h1>
        <p className="subtitle">numpy mesh generation + Three.js WebGL rendering</p>
        <StatusBadge status={status} />
      </header>

      {status === "error" && (
        <div className="error-banner">
          <p>Failed to load Pyodide: {pyErr?.message}</p>
          <button onClick={retry} className="btn btn-retry">
            Retry
          </button>
        </div>
      )}

      <div className="main-layout">
        <aside className="sidebar">
          <h2>Surface</h2>
          <div className="surface-selector">
            {(["sphere", "torus", "trefoil_knot"] as SurfaceKind[]).map((k) => (
              <label key={k} className={`surface-option ${kind === k ? "active" : ""}`}>
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={kind === k}
                  onChange={() => setKind(k)}
                />
                {SURFACE_LABELS[k]}
              </label>
            ))}
          </div>

          <h2>Parameters</h2>
          <Slider
            label="Resolution"
            value={resolution}
            min={16}
            max={128}
            step={8}
            onChange={setResolution}
          />
          <Slider label="Scale" value={scale} min={0.5} max={2.0} step={0.1} onChange={setScale} />
          <Slider label="Param" value={param} min={0.1} max={0.8} step={0.05} onChange={setParam} />

          <div className="toggle-group">
            <input
              type="checkbox"
              id="wireframe"
              checked={wireframe}
              onChange={(e) => setWireframe(e.target.checked)}
            />
            <label htmlFor="wireframe">Wireframe overlay</label>
          </div>

          <button
            className="btn btn-action"
            onClick={handleGenerate}
            disabled={status !== "ready" || gen.isLoading}
          >
            {gen.isLoading ? "Generating..." : "Generate Mesh"}
          </button>

          {gen.error && <p className="error-text">{gen.error.message}</p>}

          {gen.result && (
            <div className="mesh-info">
              <span>{gen.result.vertex_count.toLocaleString()}</span> vertices
              {" · "}
              <span>{gen.result.face_count.toLocaleString()}</span> faces
            </div>
          )}
        </aside>

        <div className="canvas-container">
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    loading: "Loading numpy...",
    ready: "Ready",
    error: "Error",
  };
  return <span className={`status-badge status-${status}`}>{labels[status] ?? status}</span>;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="slider-group">
      <label>
        {label}:{" "}
        <strong>
          {value}
          {unit ? ` ${unit}` : ""}
        </strong>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export default App;
