# ユーザープロジェクト構造ガイド

pyodide-bridge を利用するプロジェクトの推奨ディレクトリ構造と開発ワークフローをまとめる。

## 1. 前提: v1 の制約

- **1 モジュール = 1 Python ファイル**: v1 では Python 側の `import` による複数ファイル構成は未対応
- **`__bridge_packages__`**: 依存パッケージは手動で明示指定
- **対応バンドラー**: Vite / Webpack / Inline blob

## 2. 推奨構造: Python・TypeScript ソースルート分離

実運用では Python 側にもドメインロジック・テスト・lint が生じるため、TypeScript プロジェクトと**ソースルートを分離する**構造を推奨する。

```
my-app/
├── python/                        # ── Python ソースルート ──
│   ├── src/
│   │   └── engine.py              #   ブリッジ対象モジュール
│   ├── tests/
│   │   ├── test_engine.py         #   pytest によるユニットテスト
│   │   └── conftest.py
│   ├── pyproject.toml             #   Python 側のプロジェクト設定
│   └── .venv/                     #   仮想環境 (gitignore)
│
├── src/                           # ── TypeScript ソースルート ──
│   ├── generated/                 #   pyodide-bridge 生成ファイル
│   │   ├── engine.types.ts
│   │   ├── engine.worker.ts
│   │   └── engine.hooks.ts
│   ├── components/
│   │   └── AnalysisPanel.tsx      #   生成 Hook を使う UI
│   └── App.tsx
│
├── pyodide-bridge.config.ts       # ブリッジ設定
├── vite.config.ts                 # Vite 設定 (alias 含む)
├── tsconfig.json
├── package.json
└── .gitignore
```

### なぜ分離するか

| 観点 | 混在 (`src/python/`) | 分離 (`python/`) |
|------|---------------------|------------------|
| Python テスト | pytest のルート設定が複雑 | `cd python && pytest` で完結 |
| pyproject.toml | プロジェクトルートに置くと TS と混在 | python/ 内に自然に配置 |
| .venv | src/ 内に仮想環境は違和感 | python/.venv で標準的 |
| lint (ruff 等) | TS linter と Python linter の対象が交差 | 各ルートで独立して実行 |
| CI ジョブ | 全部まとめて実行 | Python / TS を並列実行可能 |

## 3. 各ファイルの詳細

### pyodide-bridge.config.ts

```typescript
import { defineConfig } from 'pyodide-bridge'

export default defineConfig({
  pyodideVersion: '0.26.4',
  modules: [
    {
      input: 'python/src/engine.py',   // Python ソースルートからの相対パス
      outdir: 'src/generated',          // TS ソースルート内の生成先
    },
  ],
  bundler: 'vite',
  react: true,
})
```

### vite.config.ts (alias 設定)

```typescript
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@python': path.resolve(__dirname, 'python/src'),
    },
  },
})
```

生成される `.worker.ts` 内で Python ソースを `?raw` で読み込む際、この alias が使用される。

### python/pyproject.toml

```toml
[project]
name = "my-app-python"
requires-python = ">=3.10"

[tool.pytest.ini_options]
testpaths = ["tests"]

[tool.ruff]
target-version = "py310"
```

### python/tests/test_engine.py

```python
"""engine.py のユニットテスト。

Pyodide 環境を使わずにドメインロジックを直接テストする。
"""
from src.engine import analyze

def test_analyze_basic():
    result = analyze({"text": "hello", "language": "en"})
    assert result["mood"] in ("happy", "sad", "neutral")
    assert 0.0 <= result["confidence"] <= 1.0
```

**ポイント**: ブリッジ経由ではなく、Python 関数を直接 import してテストする。Pyodide の初期化は不要。

## 4. 開発ワークフロー

### 日常の開発サイクル

```bash
# 1. Python ドメインロジックを編集
vim python/src/engine.py

# 2. Python 側のテスト
cd python && python -m pytest -v && cd ..

# 3. ブリッジコード再生成
npx pyodide-bridge gen

# 4. TypeScript 側の開発
npm run dev

# 5. TypeScript 側のテスト
npm test
```

### CI パイプライン

```yaml
jobs:
  python:
    steps:
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - run: |
          cd python
          pip install -e ".[dev]"
          pytest -v
          ruff check src/

  typescript:
    steps:
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx pyodide-bridge gen --check   # 生成ファイルが最新か
      - run: npm test
      - run: npm run build
```

`python` ジョブと `typescript` ジョブは**並列実行**可能。

## 5. 複数モジュールの場合

```
my-app/
├── python/
│   ├── src/
│   │   ├── analysis.py        # 分析エンジン
│   │   └── transform.py       # データ変換エンジン
│   └── tests/
│       ├── test_analysis.py
│       └── test_transform.py
├── src/
│   ├── generated/
│   │   ├── analysis.types.ts
│   │   ├── analysis.worker.ts
│   │   ├── analysis.hooks.ts
│   │   ├── transform.types.ts
│   │   ├── transform.worker.ts
│   │   └── transform.hooks.ts
│   └── ...
└── pyodide-bridge.config.ts
```

```typescript
// pyodide-bridge.config.ts
export default defineConfig({
  pyodideVersion: '0.26.4',
  modules: [
    { input: 'python/src/analysis.py',  outdir: 'src/generated' },
    { input: 'python/src/transform.py', outdir: 'src/generated' },
  ],
})
```

各モジュールは**独立した Worker** として生成される。

## 6. v1 の制約と回避策

### Python ファイル間の import が使えない

v1 では `engine.py` が `from utils import helper` のように他ファイルを import することは未対応。

**回避策**:
- ブリッジ対象のモジュールは**自己完結した単一ファイル**にする
- 共通ロジックがある場合は、ファイル内に直接記述する
- ファイルが肥大化する場合は、複数の独立モジュールに分割する（各モジュールが独立した Worker になる）

### Python テスト時の import パス

`python/src/engine.py` を `python/tests/test_engine.py` からテストする際、`PYTHONPATH` の設定が必要。

```toml
# python/pyproject.toml
[tool.pytest.ini_options]
pythonpath = ["src"]
```

これにより `from engine import analyze` で直接 import できる。

## 7. .gitignore の追加項目

```gitignore
# Python
python/.venv/
python/__pycache__/
python/**/__pycache__/
*.pyc

# pyodide-bridge generated (コミットする場合はこの行を削除)
# src/generated/
```

**生成ファイルのコミットポリシー**:
- **コミットする** (推奨): `--check` で CI 検証。Python 環境なしでも TS ビルド可能
- **コミットしない**: CI で毎回生成。Python 環境が CI に必須
