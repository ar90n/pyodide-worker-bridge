"""Signal processing demo — pyodide-bridge scientific example.

Demonstrates numpy, scipy, and matplotlib (SVG rendering) with
pyodide-bridge type annotations.
"""

import matplotlib
matplotlib.use("Agg")  # headless backend — MUST be before pyplot import

from typing import TypedDict, Literal, Required, Optional
import io

import numpy as np
from scipy.signal import butter, sosfilt  # type: ignore[import-untyped]
import matplotlib.pyplot as plt


# ---------------------------------------------------------------------------
# Type definitions
# ---------------------------------------------------------------------------


class SignalParams(TypedDict, total=False):
    """Parameters for signal generation."""

    frequency: float   # Hz (default: 5.0)
    noise_level: float  # 0.0–1.0 (default: 0.3)
    duration: float    # seconds (default: 1.0)
    sample_rate: int   # Hz (default: 500)


class SignalResult(TypedDict):
    """Generated signal data."""

    time: list[float]
    clean_signal: list[float]
    noisy_signal: list[float]
    sample_rate: int


class FilterParams(TypedDict):
    """Parameters for signal filtering."""

    time: list[float]
    signal: list[float]
    sample_rate: int
    cutoff: float  # Hz


class FilterResult(TypedDict):
    """Filtered signal data."""

    time: list[float]
    original: list[float]
    filtered: list[float]
    cutoff: float


PlotKind = Literal["signal", "filter", "spectrum"]


class PlotParams(TypedDict, total=False):
    """Parameters for SVG chart generation."""

    time: Required[list[float]]
    signals: Required[dict[str, list[float]]]
    title: str
    kind: PlotKind  # default: "signal"


class PlotResult(TypedDict):
    """SVG chart result."""

    svg: str
    width: int
    height: int


# ---------------------------------------------------------------------------
# Bridge metadata
# ---------------------------------------------------------------------------

__bridge_exports__ = ["generate_signal", "filter_signal", "plot_signal"]
__bridge_packages__ = ["numpy", "scipy", "matplotlib"]


# ---------------------------------------------------------------------------
# Implementation
# ---------------------------------------------------------------------------


def generate_signal(params: SignalParams) -> SignalResult:
    """Generate a sine wave with optional additive noise using numpy."""
    freq = params.get("frequency", 5.0)
    noise = params.get("noise_level", 0.3)
    duration = params.get("duration", 1.0)
    sr = params.get("sample_rate", 500)

    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    clean = np.sin(2 * np.pi * freq * t)
    noisy = clean + noise * np.random.default_rng(42).standard_normal(len(t))

    return {
        "time": t.tolist(),
        "clean_signal": clean.tolist(),
        "noisy_signal": noisy.tolist(),
        "sample_rate": sr,
    }


def filter_signal(params: FilterParams) -> FilterResult:
    """Apply a Butterworth low-pass filter using scipy."""
    time = params["time"]
    signal = params["signal"]
    sr = params["sample_rate"]
    cutoff = params["cutoff"]

    # 4th-order Butterworth low-pass filter
    sos = butter(4, cutoff, btype="low", fs=sr, output="sos")
    filtered = sosfilt(sos, np.array(signal))

    return {
        "time": time,
        "original": signal,
        "filtered": filtered.tolist(),
        "cutoff": cutoff,
    }


def plot_signal(params: PlotParams) -> PlotResult:
    """Render signals as an SVG chart using matplotlib."""
    time = params["time"]
    signals = params["signals"]
    title = params.get("title", "Signal")
    kind: PlotKind = params.get("kind", "signal")  # type: ignore[assignment]

    fig_w, fig_h = 9, 4

    if kind == "spectrum":
        fig, ax = plt.subplots(figsize=(fig_w, fig_h))
        for label, data in signals.items():
            n = len(data)
            sr = int(1.0 / (time[1] - time[0])) if len(time) > 1 else 500
            freqs = np.fft.rfftfreq(n, d=1.0 / sr)
            magnitude = np.abs(np.fft.rfft(data)) / n
            ax.plot(freqs, magnitude, label=label, linewidth=1.2)
        ax.set_xlabel("Frequency (Hz)")
        ax.set_ylabel("Magnitude")
        ax.set_title(title)
        ax.legend()
        ax.grid(True, alpha=0.3)
    else:
        fig, ax = plt.subplots(figsize=(fig_w, fig_h))
        colors = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444"]
        for i, (label, data) in enumerate(signals.items()):
            color = colors[i % len(colors)]
            alpha = 0.4 if "noisy" in label.lower() else 0.9
            lw = 1.0 if "noisy" in label.lower() else 1.5
            ax.plot(time, data, label=label, color=color, alpha=alpha, linewidth=lw)
        ax.set_xlabel("Time (s)")
        ax.set_ylabel("Amplitude")
        ax.set_title(title)
        ax.legend()
        ax.grid(True, alpha=0.3)

    fig.tight_layout()

    buf = io.StringIO()
    fig.savefig(buf, format="svg", bbox_inches="tight")
    plt.close(fig)
    svg_str = buf.getvalue()

    return {
        "svg": svg_str,
        "width": int(fig_w * 100),
        "height": int(fig_h * 100),
    }
