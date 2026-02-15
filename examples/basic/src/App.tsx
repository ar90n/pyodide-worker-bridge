import { useState } from "react";
import { usePyodide, useAnalyze } from "./generated/engine.hooks";
import type { AnalysisMode, AnalysisResult } from "./generated/engine.types";
import "./App.css";

const SAMPLE_TEXT = `Python is a high-level programming language. It is widely used for web development, data analysis, artificial intelligence, and scientific computing. Python's simple syntax makes it an excellent choice for beginners. Many developers love Python for its readability and versatility.`;

const MODES: { value: AnalysisMode; label: string; description: string }[] = [
  {
    value: "word_count",
    label: "Word Count",
    description: "Count words and find the most frequent ones",
  },
  {
    value: "char_freq",
    label: "Character Frequency",
    description: "Analyze character distribution",
  },
  {
    value: "summary",
    label: "Summary",
    description: "Get text statistics overview",
  },
];

function App() {
  const { status, error: pyodideError, api, retry } = usePyodide<
    import("./generated/engine.worker").BridgeAPI
  >({
    worker: new URL("./generated/engine.worker.ts", import.meta.url).href,
  });

  const {
    result,
    error: analysisError,
    isLoading,
    execute,
  } = useAnalyze(api);

  const [text, setText] = useState(SAMPLE_TEXT);
  const [mode, setMode] = useState<AnalysisMode>("word_count");

  const handleAnalyze = () => {
    execute({ text, mode });
  };

  return (
    <div className="app">
      <header className="header">
        <h1>pyodide-bridge example</h1>
        <p className="subtitle">Text Analyzer — Python running in your browser via Web Worker</p>
        <StatusBadge status={status} />
      </header>

      {status === "error" && (
        <div className="error-banner">
          <p>Failed to load Pyodide: {pyodideError?.message}</p>
          <button onClick={retry} className="btn btn-retry">
            Retry
          </button>
        </div>
      )}

      <main className="main">
        <section className="input-section">
          <label htmlFor="text-input">Input Text</label>
          <textarea
            id="text-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Enter text to analyze..."
          />

          <div className="mode-selector">
            {MODES.map((m) => (
              <label key={m.value} className={`mode-option ${mode === m.value ? "active" : ""}`}>
                <input
                  type="radio"
                  name="mode"
                  value={m.value}
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                />
                <span className="mode-label">{m.label}</span>
                <span className="mode-desc">{m.description}</span>
              </label>
            ))}
          </div>

          <button
            className="btn btn-analyze"
            onClick={handleAnalyze}
            disabled={status !== "ready" || isLoading || !text.trim()}
          >
            {isLoading ? "Analyzing..." : "Analyze"}
          </button>
        </section>

        {analysisError && (
          <div className="error-banner">
            <p>Analysis error: {analysisError.message}</p>
          </div>
        )}

        {result && <ResultView result={result} />}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    loading: "Loading Pyodide...",
    ready: "Ready",
    error: "Error",
  };
  return <span className={`status-badge status-${status}`}>{labels[status] ?? status}</span>;
}

function ResultView({ result }: { result: AnalysisResult }) {
  return (
    <section className="result-section">
      <h2>
        Results <span className="mode-tag">{result.mode}</span>
      </h2>

      {result.word_count && (
        <div className="result-card">
          <div className="stats-row">
            <Stat label="Total words" value={result.word_count.total_words} />
            <Stat label="Unique words" value={result.word_count.unique_words} />
          </div>
          <h3>Top Words</h3>
          <table className="freq-table">
            <thead>
              <tr>
                <th>Word</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {result.word_count.top_words.map((w) => (
                <tr key={w.word}>
                  <td>{w.word}</td>
                  <td>{w.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.char_freq && (
        <div className="result-card">
          <Stat label="Total characters" value={result.char_freq.total_chars} />
          <h3>Character Frequencies</h3>
          <div className="bar-chart">
            {result.char_freq.frequencies.map((f) => (
              <div key={f.char} className="bar-row">
                <span className="bar-label">{f.char}</span>
                <div
                  className="bar"
                  style={{
                    width: `${(f.count / result.char_freq!.frequencies[0].count) * 100}%`,
                  }}
                />
                <span className="bar-value">{f.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.summary && (
        <div className="result-card">
          <div className="stats-row">
            <Stat label="Words" value={result.summary.total_words} />
            <Stat label="Characters" value={result.summary.total_chars} />
            <Stat label="Avg word length" value={result.summary.avg_word_length} />
            <Stat label="Sentences" value={result.summary.sentence_count} />
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export default App;
