import { useState } from "react";
import {
  usePyodide,
  useGenerateSignal,
  useFilterSignal,
  usePlotSignal,
} from "./generated/science.hooks";
import type {
  SignalResult,
  FilterResult,
  PlotKind,
} from "./generated/science.types";
import "./App.css";

function App() {
  const { status, error: pyErr, api, retry } = usePyodide<
    import("./generated/science.worker").BridgeAPI
  >({
    worker: new URL("./generated/science.worker.ts", import.meta.url).href,
  });

  const gen = useGenerateSignal(api);
  const flt = useFilterSignal(api);
  const plt = usePlotSignal(api);

  // Parameters
  const [frequency, setFrequency] = useState(5);
  const [noiseLevel, setNoiseLevel] = useState(0.3);
  const [cutoff, setCutoff] = useState(10);
  const [plotKind, setPlotKind] = useState<PlotKind>("signal");

  // Stored results
  const [signalData, setSignalData] = useState<SignalResult | null>(null);
  const [filterData, setFilterData] = useState<FilterResult | null>(null);

  const handleGenerate = async () => {
    await gen.execute({
      frequency,
      noise_level: noiseLevel,
      duration: 1.0,
      sample_rate: 500,
    });
  };

  // store signal result when it arrives
  const currentSignal = gen.result ?? signalData;
  if (gen.result && gen.result !== signalData) {
    setSignalData(gen.result);
    setFilterData(null); // reset filter on new signal
  }

  const handleFilter = async () => {
    if (!currentSignal) return;
    await flt.execute({
      time: currentSignal.time,
      signal: currentSignal.noisy_signal,
      sample_rate: currentSignal.sample_rate,
      cutoff,
    });
  };

  const currentFilter = flt.result ?? filterData;
  if (flt.result && flt.result !== filterData) {
    setFilterData(flt.result);
  }

  const handlePlot = async () => {
    if (!currentSignal) return;
    const signals: Record<string, number[]> = {
      Clean: currentSignal.clean_signal,
      Noisy: currentSignal.noisy_signal,
    };
    if (currentFilter) {
      signals["Filtered"] = currentFilter.filtered;
    }
    const titles: Record<PlotKind, string> = {
      signal: "Time Domain",
      filter: "Filter Comparison",
      spectrum: "Frequency Spectrum",
    };
    await plt.execute({
      time: currentSignal.time,
      signals,
      title: titles[plotKind],
      kind: plotKind,
    });
  };

  return (
    <div className="app">
      <header className="header">
        <h1>pyodide-bridge scientific example</h1>
        <p className="subtitle">
          numpy + scipy + matplotlib running in your browser
        </p>
        <StatusBadge status={status} />
      </header>

      {status === "error" && (
        <div className="error-banner">
          <p>Failed to load Pyodide: {pyErr?.message}</p>
          <button onClick={retry} className="btn btn-retry">Retry</button>
        </div>
      )}

      <main className="main">
        {/* Step 1: Generate Signal */}
        <section className="step">
          <h2>
            <span className="step-num">1</span> Generate Signal
            <span className="step-tag">numpy</span>
          </h2>
          <div className="controls">
            <Slider label="Frequency" value={frequency} min={1} max={50} step={1} unit="Hz" onChange={setFrequency} />
            <Slider label="Noise Level" value={noiseLevel} min={0} max={1} step={0.05} onChange={setNoiseLevel} />
          </div>
          <button className="btn btn-action" onClick={handleGenerate} disabled={status !== "ready" || gen.isLoading}>
            {gen.isLoading ? "Generating..." : "Generate"}
          </button>
          {gen.error && <p className="error-text">{gen.error.message}</p>}
          {currentSignal && (
            <p className="result-info">
              {currentSignal.time.length} samples at {currentSignal.sample_rate} Hz
            </p>
          )}
        </section>

        {/* Step 2: Filter Signal */}
        <section className="step">
          <h2>
            <span className="step-num">2</span> Filter Signal
            <span className="step-tag">scipy</span>
          </h2>
          <div className="controls">
            <Slider label="Cutoff" value={cutoff} min={1} max={100} step={1} unit="Hz" onChange={setCutoff} />
          </div>
          <button className="btn btn-action" onClick={handleFilter} disabled={!currentSignal || status !== "ready" || flt.isLoading}>
            {flt.isLoading ? "Filtering..." : "Filter"}
          </button>
          {flt.error && <p className="error-text">{flt.error.message}</p>}
          {currentFilter && (
            <p className="result-info">
              Butterworth LPF at {currentFilter.cutoff} Hz applied
            </p>
          )}
        </section>

        {/* Step 3: Plot */}
        <section className="step">
          <h2>
            <span className="step-num">3</span> Plot
            <span className="step-tag">matplotlib</span>
          </h2>
          <div className="plot-kind-selector">
            {(["signal", "filter", "spectrum"] as PlotKind[]).map((k) => (
              <label key={k} className={`kind-option ${plotKind === k ? "active" : ""}`}>
                <input type="radio" name="plotKind" value={k} checked={plotKind === k} onChange={() => setPlotKind(k)} />
                {k}
              </label>
            ))}
          </div>
          <button className="btn btn-action" onClick={handlePlot} disabled={!currentSignal || status !== "ready" || plt.isLoading}>
            {plt.isLoading ? "Rendering..." : "Plot SVG"}
          </button>
          {plt.error && <p className="error-text">{plt.error.message}</p>}
        </section>

        {/* SVG Result */}
        {plt.result && (
          <section className="svg-container">
            <div dangerouslySetInnerHTML={{ __html: plt.result.svg }} />
          </section>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    loading: "Loading numpy + scipy + matplotlib...",
    ready: "Ready",
    error: "Error",
  };
  return <span className={`status-badge status-${status}`}>{labels[status] ?? status}</span>;
}

function Slider({
  label, value, min, max, step, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="slider-group">
      <label>
        {label}: <strong>{value}{unit ? ` ${unit}` : ""}</strong>
      </label>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export default App;
