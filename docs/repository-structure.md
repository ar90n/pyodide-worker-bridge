# リポジトリ構造定義書: pyodide-bridge

## 1. ディレクトリ構造

```
pyodide-bridge/
├── .claude/                      # Claude Code 設定
│   ├── commands/                 # カスタムコマンド
│   ├── agents/                   # サブエージェント定義
│   └── skills/                   # スキル定義
│
├── .github/                      # GitHub Actions
│   └── workflows/
│       ├── ci.yml                # テスト・リント・ビルド
│       └── release.yml           # npm publish
│
├── docs/                         # プロジェクトドキュメント
│   ├── product-requirements.md   # プロダクト要求定義書
│   ├── functional-design.md      # 機能設計書
│   ├── architecture.md           # アーキテクチャ設計書
│   ├── repository-structure.md   # リポジトリ構造定義書 (本ファイル)
│   ├── development-guidelines.md # 開発ガイドライン
│   └── glossary.md               # 用語集
│
├── src/                          # TypeScript ソース
│   ├── cli/                      # CLI レイヤー
│   │   ├── bin.ts                # CLI エントリポイント (#!/usr/bin/env node)
│   │   ├── config.ts             # 設定ファイルローダー・バリデーション
│   │   ├── python-parser.ts      # Python 子プロセス呼び出し・IR パース
│   │   ├── check.ts              # --check モードの差分検出
│   │   └── emitters/             # コード生成器
│   │       ├── types.ts          # .types.ts エミッター
│   │       ├── worker.ts         # .worker.ts エミッター
│   │       └── hooks.ts          # .hooks.ts エミッター (React)
│   │
│   ├── runtime/                  # Runtime レイヤー (フレームワーク非依存)
│   │   ├── index.ts              # runtime 公開 API
│   │   ├── worker-bootstrap.ts   # Pyodide CDN ロード・初期化
│   │   ├── deep-convert.ts       # Map → plain object 再帰変換
│   │   ├── error.ts              # BridgeError クラス・エラー検出
│   │   └── comlink-helpers.ts    # Proxy-safe setState ラッパー
│   │
│   ├── react/                    # React レイヤー
│   │   ├── index.ts              # react 公開 API
│   │   ├── use-pyodide.ts        # usePyodide Hook
│   │   └── create-hook.ts        # 関数別 Hook ファクトリ
│   │
│   ├── types.ts                  # 共通型定義 (ModuleIR 等)
│   └── index.ts                  # パッケージルート公開 API
│
├── parser/                       # Python AST パーサー
│   ├── parser.py                 # メインパーサースクリプト
│   └── test_parser.py            # パーサーユニットテスト (pytest)
│
├── tests/                        # TypeScript テスト
│   ├── cli/                      # CLI テスト
│   │   ├── python-parser.test.ts
│   │   ├── emitters/
│   │   │   ├── types.test.ts
│   │   │   ├── worker.test.ts
│   │   │   └── hooks.test.ts
│   │   ├── config.test.ts
│   │   └── check.test.ts
│   │
│   ├── runtime/                  # Runtime テスト
│   │   ├── deep-convert.test.ts
│   │   ├── error.test.ts
│   │   └── comlink-helpers.test.ts
│   │
│   └── fixtures/                 # テストフィクスチャ
│       ├── simple.py             # 基本的な TypedDict + 関数
│       ├── multiple-types.py     # 複数の型定義
│       ├── no-exports.py         # __bridge_exports__ なし
│       └── syntax-error.py       # 構文エラーのある Python
│
├── examples/                     # 使用例
│   └── react-vite/               # Vite + React サンプルアプリ
│       ├── src/
│       │   ├── python/
│       │   │   └── engine.py     # サンプル Python モジュール
│       │   ├── generated/        # 生成ファイル配置先
│       │   └── App.tsx           # サンプル React コンポーネント
│       ├── pyodide-bridge.config.ts
│       └── package.json
│
├── package.json
├── tsconfig.json                 # TypeScript 設定
├── tsup.config.ts                # バンドル設定
├── vitest.config.ts              # テスト設定
├── .gitignore
├── .prettierrc                   # フォーマッター設定
├── LICENSE                       # MIT License
└── README.md                     # プロジェクト README
```

## 2. ファイル命名規則

| 種別              | 規則             | 例                                       |
| ----------------- | ---------------- | ---------------------------------------- |
| TypeScript ソース | kebab-case       | `worker-bootstrap.ts`, `deep-convert.ts` |
| テストファイル    | `{対象}.test.ts` | `deep-convert.test.ts`                   |
| Python ソース     | snake_case       | `parser.py`, `test_parser.py`            |
| 設定ファイル      | ツール公式の命名 | `tsconfig.json`, `vitest.config.ts`      |
| ドキュメント      | kebab-case       | `product-requirements.md`                |
| ディレクトリ      | kebab-case       | `comlink-helpers/`                       |

## 3. エントリポイント

### npm パッケージエントリ

| パス                   | 用途                                 | exports キー  |
| ---------------------- | ------------------------------------ | ------------- |
| `src/index.ts`         | ルート公開 API（型定義の re-export） | `"."`         |
| `src/runtime/index.ts` | Runtime API                          | `"./runtime"` |
| `src/react/index.ts`   | React Hooks API                      | `"./react"`   |
| `src/cli/bin.ts`       | CLI バイナリ                         | `"bin"`       |

### ビルド出力

| ソース             | 出力                              | 形式   |
| ------------------ | --------------------------------- | ------ |
| `src/**/*.ts`      | `dist/**/*.js` + `dist/**/*.d.ts` | ESM    |
| `parser/parser.py` | `dist/parser/parser.py` (コピー)  | Python |

## 4. 設定ファイル一覧

| ファイル           | 用途                          |
| ------------------ | ----------------------------- |
| `package.json`     | npm パッケージ定義            |
| `tsconfig.json`    | TypeScript コンパイラ設定     |
| `tsup.config.ts`   | tsup バンドル設定             |
| `vitest.config.ts` | Vitest テスト設定             |
| `.prettierrc`      | Prettier コードフォーマッター |
| `.gitignore`       | Git 除外ファイル              |

## 5. テストファイル配置ルール

- テストファイルは `tests/` ディレクトリに、ソースと同じ階層構造で配置
- テストフィクスチャ（Python ファイル等）は `tests/fixtures/` に配置
- スナップショットファイルは Vitest デフォルト（テストファイルと同階層の `__snapshots__/`）
- Python パーサーのテストは `parser/test_parser.py` に配置（pytest）
