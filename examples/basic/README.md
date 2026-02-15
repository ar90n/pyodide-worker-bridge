# pyodide-bridge example — Text Analyzer

Pyodide (Python in the browser) を Web Worker で実行し、React Hook で呼び出すデモアプリです。

## セットアップ

```bash
# 1. ライブラリ本体をビルド（ルートで実行）
cd ../..
npm run build
cd examples/basic

# 2. 依存インストール
npm install

# 3. ブリッジコード生成
npm run generate

# 4. 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:5173 を開くと、テキスト分析アプリが表示されます。

## ファイル構成

```
examples/basic/
├── python/src/engine.py          # Python ドメインロジック（テキスト分析）
├── src/
│   ├── generated/                # pyodide-bridge gen が自動生成
│   │   ├── engine.types.ts       #   TypeScript 型定義
│   │   ├── engine.worker.ts      #   Web Worker（Pyodide 初期化 + Comlink）
│   │   ├── engine.hooks.ts       #   React Hook（usePyodide + useAnalyze）
│   │   └── engine.py             #   Python ソース（Worker が ?raw で読み込む）
│   ├── App.tsx                   # メイン UI コンポーネント
│   ├── App.css                   # スタイル
│   └── main.tsx                  # エントリポイント
├── pyodide-bridge.config.mjs     # ブリッジ設定
├── vite.config.ts                # Vite 設定
└── package.json
```

## 開発ワークフロー

1. `python/src/engine.py` を編集
2. `npm run generate` でブリッジコードを再生成
3. `npm run dev` で変更を確認

## 使用している pyodide-bridge の機能

| 機能 | 場所 |
|------|------|
| TypedDict → TypeScript type | `engine.types.ts` |
| Literal → union type | `AnalysisMode` |
| Required / Optional フィールド | `AnalysisParams.text` (required), `.mode` (optional) |
| Worker 自動生成 | `engine.worker.ts` |
| `usePyodide` Hook | `App.tsx` — Worker ライフサイクル管理 |
| `useAnalyze` Hook | `App.tsx` — 関数呼び出し + 状態管理 |
