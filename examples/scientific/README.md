# pyodide-bridge example — Signal Processing

numpy + scipy + matplotlib を Pyodide Web Worker で実行し、matplotlib の SVG 出力を React に表示するデモです。

## セットアップ

```bash
# 1. ライブラリ本体をビルド（ルートで実行）
cd ../..
npm run build
cd examples/scientific

# 2. 依存インストール
npm install

# 3. ブリッジコード生成
npm run generate

# 4. 開発サーバー起動
npm run dev
```

> **Note**: 初回ロード時に Pyodide + numpy + scipy + matplotlib のダウンロード（約 30MB）が発生するため、数十秒かかります。

## 操作フロー

1. **Generate** — numpy でノイズ付き正弦波を生成（パラメータ: 周波数、ノイズレベル）
2. **Filter** — scipy.signal でバターワース・ローパスフィルタを適用（パラメータ: カットオフ周波数）
3. **Plot** — matplotlib で SVG チャートを生成・表示（種類: 時間領域 / フィルタ比較 / 周波数スペクトル）

## ファイル構成

```
examples/scientific/
├── python/src/science.py          # Python ドメインロジック
├── src/
│   ├── generated/                 # pyodide-bridge gen が自動生成
│   │   ├── science.types.ts       #   TypeScript 型定義
│   │   ├── science.worker.ts      #   Web Worker
│   │   ├── science.hooks.ts       #   React Hook
│   │   └── science.py             #   Python ソース（Worker 用コピー）
│   ├── App.tsx                    # 3 ステップ UI
│   ├── App.css
│   └── main.tsx
├── pyodide-bridge.config.mjs
└── package.json
```

## 使用している技術

| 技術           | 用途                                                                   |
| -------------- | ---------------------------------------------------------------------- |
| numpy          | 信号生成（`np.sin`, `np.random`）、FFT（`np.fft`）                     |
| scipy          | バターワースフィルタ（`scipy.signal.butter`, `sosfilt`）               |
| matplotlib     | SVG チャートレンダリング（Agg バックエンド + `savefig(format='svg')`） |
| pyodide-bridge | Python ↔ TypeScript 型安全ブリッジ、Worker 自動生成                    |

## matplotlib SVG パターン

Python 側で matplotlib を SVG バックエンドで使い、文字列として返すパターン:

```python
import io
import matplotlib.pyplot as plt

fig, ax = plt.subplots()
ax.plot(data)

buf = io.StringIO()
fig.savefig(buf, format="svg", bbox_inches="tight")
plt.close(fig)

svg_string = buf.getvalue()  # → TypeScript に文字列として返る
```

React 側で表示:

```tsx
<div dangerouslySetInnerHTML={{ __html: plotResult.svg }} />
```
