# アーキテクチャ設計書: pyodide-bridge

## 1. アーキテクチャ概要

pyodide-bridge は **3 層アーキテクチャ** を採用する。各層は独立したエントリポイントを持ち、ツリーシェイキングが可能な形で公開される。

```
┌─────────────────────────────────────────────────┐
│                   CLI Layer                      │
│  pyodide-bridge gen                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Python   │→│    IR     │→│   Emitters    │  │
│  │  Parser   │  │ (Module  │  │ types/worker/ │  │
│  │(python3)  │  │   IR)    │  │    hooks      │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                Runtime Layer                     │
│  pyodide-bridge/runtime                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Worker   │  │  Deep    │  │   Bridge      │  │
│  │Bootstrap │  │ Convert  │  │   Error       │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│               React Layer                        │
│  pyodide-bridge/react                            │
│  ┌──────────┐  ┌───────────────┐                │
│  │  use     │  │  create       │                │
│  │ Pyodide  │  │ BridgeHook   │                │
│  └──────────┘  └───────────────┘                │
└─────────────────────────────────────────────────┘
```

## 2. レイヤー詳細

### 2.1 CLI Layer

**責務**: Python ソースをパースし、TypeScript コードを生成する。開発時のみ使用。

**パイプライン**:
```
Python Source → [Python Parser] → Module IR → [Emitter] → TypeScript Files
                  (python3)        (JSON)      (Node.js)
```

**コンポーネント**:

| コンポーネント | 責務 |
|--------------|------|
| `cli/bin.ts` | CLI エントリポイント。引数解析、設定ファイル読み込み |
| `cli/config.ts` | `pyodide-bridge.config.ts` のロードとバリデーション |
| `cli/python-parser.ts` | `python3` 子プロセスを起動し、Python AST パーサースクリプトを実行 |
| `cli/parser.py` | Python 側の AST パーサー。モジュール IR を JSON で stdout に出力 |
| `cli/emitters/types.ts` | IR → `.types.ts` 生成 |
| `cli/emitters/worker.ts` | IR → `.worker.ts` 生成 |
| `cli/emitters/hooks.ts` | IR → `.hooks.ts` 生成 |
| `cli/check.ts` | `--check` モード: 生成結果と既存ファイルの差分検出 |

**Python Parser との連携**:
```
Node.js (CLI)                    Python (parser.py)
     │                                │
     ├─ spawn('python3', [           │
     │    'parser.py', inputPath])    │
     │                                │
     │    stdin: (unused)             │
     │    stdout: JSON (Module IR) ←──┤ ast.parse() → walk → serialize
     │    stderr: error messages   ←──┤
     │                                │
     ├─ JSON.parse(stdout)            │
     │                                │
     └─ return ModuleIR               │
```

### 2.2 Runtime Layer

**責務**: ブラウザ上で Pyodide Worker の初期化・通信・データ変換を行う。フレームワーク非依存。

**コンポーネント**:

| コンポーネント | 責務 |
|--------------|------|
| `runtime/worker-bootstrap.ts` | Pyodide CDN ロード、パッケージインストール、Python 実行 |
| `runtime/deep-convert.ts` | `Map` → plain object 再帰変換 |
| `runtime/error.ts` | `BridgeError` クラス、エラー辞書パターン検出 |
| `runtime/comlink-helpers.ts` | Proxy-safe setState ラッパー |

**依存関係**: `comlink` (peer dependency)

### 2.3 React Layer

**責務**: React 固有のステート管理・ライフサイクル管理を提供する。

**コンポーネント**:

| コンポーネント | 責務 |
|--------------|------|
| `react/use-pyodide.ts` | Worker 生成・初期化・状態管理・再試行 |
| `react/create-hook.ts` | 関数別 Hook のファクトリ |

**依存関係**: `react` (peer dependency), `comlink` (peer dependency)

## 3. データフロー

### 3.1 コード生成フロー

```
User runs: pyodide-bridge gen --input engine.py --outdir src/generated

1. CLI が設定を解析 (CLI引数 > config file > defaults)
2. python3 parser.py engine.py を実行
3. parser.py が Python AST を解析し、ModuleIR を JSON で出力
4. CLI が JSON をパースし ModuleIR を取得
5. types emitter が ModuleIR → engine.types.ts を生成
6. worker emitter が ModuleIR → engine.worker.ts を生成
7. hooks emitter が ModuleIR → engine.hooks.ts を生成
8. 3ファイルを outdir に書き出し
```

### 3.2 ランタイムデータフロー

```
Main Thread (React)              Web Worker                Pyodide (Python)
       │                              │                         │
       │  usePyodide() mount          │                         │
       ├─ new Worker(url) ───────────→│                         │
       │                              ├─ loadPyodide(CDN) ─────→│
       │                              ├─ micropip.install() ────→│
       │                              ├─ runPython(source) ─────→│
       │                              ├─ Comlink.expose(api)     │
       │  status: 'ready' ←──────────┤                         │
       │                              │                         │
       │  execute(params)             │                         │
       ├─ Comlink.proxy.method() ────→│                         │
       │                              ├─ pyodide.toPy(params) ──→│
       │                              │                         ├─ fn(params)
       │                              │  pyResult.toJs() ←──────┤
       │                              ├─ deepConvertMaps(js)     │
       │                              ├─ detectBridgeError(js)   │
       │  result / error ←────────────┤                         │
       │                              │                         │
```

### 3.3 エラーフロー

```
Python function returns:
  {"error": {"code": "INVALID_INPUT", "message": "..."}}

Worker:
  1. toJs() → Map{error: Map{code: ..., message: ...}}
  2. deepConvertMaps() → {error: {code: ..., message: ...}}
  3. detectBridgeError() → throw new BridgeError("INVALID_INPUT", "...")

React Hook:
  1. catch(err) → if (err instanceof BridgeError)
  2. setError(err)
  3. setIsLoading(false)
```

## 4. 中間表現 (Module IR)

CLI パイプラインの中心となるデータ構造。Python Parser が出力し、各 Emitter が消費する。

```typescript
interface ModuleIR {
  moduleName: string
  types: TypeNode[]
  functions: FunctionNode[]
  packages: string[]
}

type TypeNode = TypeDictNode | LiteralAliasNode

interface TypeDictNode {
  kind: 'typeddict'
  name: string
  total: boolean
  fields: FieldNode[]
}

interface FieldNode {
  name: string
  type: TypeRef
  required: boolean  // total + Required/NotRequired で決定
}

interface LiteralAliasNode {
  kind: 'literal'
  name: string
  values: (string | number | boolean)[]
}

interface FunctionNode {
  name: string
  params: { name: string; type: TypeRef }[]
  returnType: TypeRef
}

type TypeRef =
  | { kind: 'primitive'; name: 'int' | 'float' | 'str' | 'bool' | 'None' }
  | { kind: 'list'; element: TypeRef }
  | { kind: 'dict'; key: TypeRef; value: TypeRef }
  | { kind: 'optional'; inner: TypeRef }
  | { kind: 'literal'; values: (string | number | boolean)[] }
  | { kind: 'reference'; name: string }  // 同一モジュール内の型参照
```

## 5. パッケージ構成

```
pyodide-bridge (npm package)
├── dist/
│   ├── cli/          # CLI (bin)
│   ├── runtime/      # Runtime utilities
│   ├── react/        # React bindings
│   └── index.js      # Public API re-exports
├── parser/
│   └── parser.py     # Python AST parser (vendored)
└── package.json
```

**package.json exports**:
```json
{
  "name": "pyodide-bridge",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./runtime": { "import": "./dist/runtime/index.js", "types": "./dist/runtime/index.d.ts" },
    "./react": { "import": "./dist/react/index.js", "types": "./dist/react/index.d.ts" }
  },
  "bin": {
    "pyodide-bridge": "./dist/cli/bin.js"
  }
}
```

## 6. 依存関係

### 本体依存 (dependencies)
- なし（ランタイム依存を最小化）

### ピア依存 (peerDependencies)
| パッケージ | 用途 | 必須/オプション |
|-----------|------|---------------|
| `comlink` | Worker ↔ Main Thread 通信 | 必須 |
| `react` | React Hooks | オプション（`react` エントリ使用時のみ） |
| `pyodide` | 型定義参照 | オプション |

### 開発依存 (devDependencies)
| パッケージ | 用途 |
|-----------|------|
| `typescript` | ビルド |
| `tsup` | バンドル |
| `vitest` | テスト |
| `@types/node` | Node.js 型定義 |

## 7. テスト戦略

### ユニットテスト

| 対象 | テスト内容 |
|------|----------|
| Python Parser | Python ソース → ModuleIR の変換正確性 |
| Type Emitter | ModuleIR → `.types.ts` のスナップショットテスト |
| Worker Emitter | ModuleIR → `.worker.ts` のスナップショットテスト |
| Hooks Emitter | ModuleIR → `.hooks.ts` のスナップショットテスト |
| deepConvertMaps | Map/Array/プリミティブの変換 |
| BridgeError | エラー辞書パターンの検出 |
| Config loader | 設定ファイルのバリデーション |

### 統合テスト

| シナリオ | テスト内容 |
|---------|----------|
| E2E コード生成 | Python ファイル → CLI 実行 → 生成ファイル検証 |
| --check モード | 最新/非最新ケースでの終了コード検証 |
| 複数モジュール | config ファイルで複数モジュールを指定して一括生成 |

### テストフレームワーク

- **Vitest**: ユニットテスト・統合テスト
- **スナップショットテスト**: 生成コードの回帰検出

## 8. セキュリティ考慮事項

- **Python 子プロセス**: `parser.py` はユーザー提供の Python ファイルを AST パースするのみ（`eval`/`exec` しない）
- **生成コード**: テンプレートリテラルに変数を埋め込む際、識別子バリデーションを行う
- **CDN ロード**: Pyodide CDN URL はバージョン固定でサブリソースインテグリティ (SRI) の使用を推奨

## 9. パフォーマンス考慮事項

- **CLI**: Python 子プロセスの起動コストは避けられないが、単一モジュールで 1 秒以内を目標
- **deepConvertMaps**: 再帰処理だが、通常のレスポンスサイズ（< 1MB）では問題にならない。大規模データは `transferable` による最適化を将来検討
- **Worker 初期化**: Pyodide CDN ロード（〜5-10秒）が支配的。ライブラリ側で短縮する余地は少ないが、状態フィードバック（loading 表示）で UX を改善
