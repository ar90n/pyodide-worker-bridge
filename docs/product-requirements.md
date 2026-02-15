# プロダクト要求定義書: pyodide-bridge

## 1. 概要

**pyodide-bridge** は、アノテーション付き Python モジュールから型安全な TypeScript ブリッジコードを自動生成するライブラリである。Web Worker 上の Pyodide ランタイムと メインスレッド（React アプリ等）を接続し、手書きのグルーコードを一切不要にする。

## 2. 背景と動機

### 課題

Web アプリケーションで Python を計算エンジンとして活用する場合、以下の課題がある:

1. **グルーコード地獄**: Pyodide の初期化、Web Worker 通信（Comlink）、型変換（Map→Object）、エラーハンドリングを毎回手書きする必要がある
2. **型安全性の欠如**: Python 側の型定義と TypeScript 側の型定義が乖離しやすく、ランタイムエラーの原因となる
3. **再利用不可能**: FilterForge プロジェクトで構築された `gen_bridge.py` パイプラインは、そのプロジェクトに密結合している

### 解決策

Python モジュールに規約に従ったアノテーション（`TypedDict`, `Literal`, `__bridge_exports__`）を記述するだけで、CLI コマンド一発で型安全な TypeScript コード（型定義、Web Worker、React Hooks）を自動生成する。

## 3. ターゲットユーザー

| ペルソナ                   | 説明                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| **フロントエンド開発者**   | React アプリに Python 計算ロジックを組み込みたいが、Pyodide/Comlink の低レベル実装は避けたい |
| **データサイエンティスト** | Python で書いた分析ロジックをブラウザで動かしたいが、TypeScript の記述量を最小化したい       |
| **フルスタック開発者**     | Python ↔ TypeScript の型安全な連携を効率的に実現したい                                       |

## 4. ユーザーストーリー

### US-1: ブリッジコードの自動生成

**As a** フロントエンド開発者
**I want to** アノテーション付き Python ファイルから TypeScript ブリッジコードを一括生成したい
**So that** 手書きのグルーコードを排除し、型安全な Python ↔ TypeScript 連携を実現できる

**受け入れ条件**:

- [ ] `pyodide-bridge gen --input <file> --outdir <dir>` で 3 ファイル（`.types.ts`, `.worker.ts`, `.hooks.ts`）が生成される
- [ ] Python の `TypedDict`, `Literal`, プリミティブ型が正しく TypeScript 型に変換される
- [ ] `__bridge_exports__` に列挙された関数のみがブリッジ対象となる
- [ ] `__bridge_packages__` で指定されたパッケージが Worker 内で自動インストールされる

### US-2: React Hooks による統合

**As a** React 開発者
**I want to** 生成された Hooks を import するだけで Python 関数を呼び出したい
**So that** Pyodide のライフサイクル管理や状態管理を意識せずに開発できる

**受け入れ条件**:

- [ ] `usePyodide()` で Worker ライフサイクル（loading / ready / error）を管理できる
- [ ] 各エクスポート関数に対応する `useXxx()` Hook が生成される
- [ ] Hook は `{ result, error, isLoading, execute }` を返す
- [ ] Comlink Proxy の setState 問題が内部で解決されている

### US-3: CI での整合性チェック

**As a** 開発チームメンバー
**I want to** CI で生成ファイルが最新かチェックしたい
**So that** Python 変更時に生成ファイルの更新漏れを検出できる

**受け入れ条件**:

- [ ] `pyodide-bridge gen --check` が、生成ファイルが最新でない場合に非ゼロ終了コードを返す
- [ ] 差分がある場合、どのファイルが古いか表示される

### US-4: 複数モジュールの管理

**As a** 大規模アプリの開発者
**I want to** 複数の Python モジュールをそれぞれ独立したブリッジとして管理したい
**So that** 機能単位でモジュールを分割し、保守性を高められる

**受け入れ条件**:

- [ ] 設定ファイル (`pyodide-bridge.config.ts`) で複数モジュールを定義できる
- [ ] 各モジュールが独立した Worker として生成される
- [ ] `pyodide-bridge gen` で全モジュールを一括生成できる

### US-5: フレームワーク非依存のランタイム

**As a** React 以外のフレームワーク（Vue, Vanilla JS 等）のユーザー
**I want to** React Hooks なしでもランタイム機能を利用したい
**So that** 任意のフレームワークから Pyodide ブリッジを使える

**受け入れ条件**:

- [ ] `pyodide-bridge/runtime` から Worker ブートストラップ、データ変換、エラーハンドリングの機能が利用可能
- [ ] React 依存のない純粋な TypeScript API が提供される

## 5. 機能要件

### 5.1 CLI (`pyodide-bridge gen`)

| 機能            | 説明                                                                              |
| --------------- | --------------------------------------------------------------------------------- |
| Python パース   | Python AST を解析し、型定義・関数シグネチャ・メタデータを抽出                     |
| 型エミット      | `.types.ts` を生成（TypedDict → interface, Literal → union, 型マッピング）        |
| Worker エミット | `.worker.ts` を生成（Pyodide CDN ロード、パッケージインストール、Comlink expose） |
| Hooks エミット  | `.hooks.ts` を生成（usePyodide, 関数別 Hook）                                     |
| チェックモード  | `--check` フラグで生成ファイルの最新性を検証                                      |
| 設定ファイル    | `pyodide-bridge.config.ts` による一括設定                                         |

### 5.2 ランタイム (`pyodide-bridge/runtime`)

| 機能                    | 説明                                                            |
| ----------------------- | --------------------------------------------------------------- |
| Worker ブートストラップ | Pyodide CDN からのロード、micropip によるパッケージインストール |
| データ変換              | `deepConvertMaps()` による Map → Object 再帰変換                |
| エラーハンドリング      | `BridgeError` 型の定義、Python エラー辞書の検出と変換           |
| Comlink ヘルパー        | Proxy-safe な setState ラッパー                                 |

### 5.3 React バインディング (`pyodide-bridge/react`)

| 機能             | 説明                                                         |
| ---------------- | ------------------------------------------------------------ |
| `usePyodide()`   | Worker ライフサイクル管理（status: loading / ready / error） |
| 関数別 Hook 生成 | 各ブリッジ関数に対応する `useXxx()` Hook                     |

### 5.4 型マッピング

| Python                    | TypeScript                     |
| ------------------------- | ------------------------------ |
| `int`, `float`            | `number`                       |
| `str`                     | `string`                       |
| `bool`                    | `boolean`                      |
| `None`                    | `null`                         |
| `list[T]`                 | `T[]`                          |
| `dict[K, V]`              | `Record<K, V>`                 |
| `Optional[T]`             | `T \| undefined`               |
| `Literal['a', 'b']`       | `'a' \| 'b'`                   |
| `Required[T]`             | required field                 |
| `NotRequired[T]`          | optional field (`?`)           |
| `TypedDict` (total=True)  | all fields required by default |
| `TypedDict` (total=False) | all fields optional by default |

## 6. 非機能要件

### パフォーマンス

- CLI のコード生成は単一モジュールで 1 秒以内に完了すること
- ランタイムの `deepConvertMaps()` は 10MB のネストデータに対して 100ms 以内

### 互換性

- Node.js 18+ (CLI)
- Pyodide 0.26.x (ランタイム)
- React 18+ (React バインディング)
- バンドラー: Vite 5+, Webpack 5+, インラインブロブ

### 開発者体験

- `npm install pyodide-bridge` のみで CLI・ランタイム・React バインディングすべて利用可能
- TypeScript ファースト（すべての公開 API に型定義付き）

## 7. 成功指標

- Python モジュールから TypeScript ブリッジへの変換が CLI 一発で完了する
- 手書きグルーコードがゼロになる（ユーザーは Python モジュールと React コンポーネントのみ記述）
- 型マッピングの正確性: Python 側の型変更が TypeScript 側に自動反映される

## 8. スコープ

### v1 スコープ内

- コード生成 CLI（Python → TypeScript 型定義、Worker、Hooks）
- ランタイムユーティリティ（Pyodide ブートストラップ、データ変換、エラーハンドリング）
- React Hooks
- Vite / Webpack サポート
- 複数 Python モジュール対応
- CI チェックモード (`--check`)

### v1 スコープ外

- React 以外のフレームワークバインディング（Vue, Svelte, Solid）
- ストリーミング / ジェネレータ関数サポート
- SharedArrayBuffer ベースのゼロコピー転送
- Python 仮想環境管理
- Hot Module Replacement（Python ソース）
- マルチワーカープール / ロードバランシング
- 複数 Python ファイルで構成されるモジュールのバンドリング（後述「将来機能」参照）
- `import` 文解析による依存パッケージ自動検出
- `__bridge_packages__` のバージョン指定構文（`['numpy==1.26.0']`）
- Pyodide 内蔵パッケージの検出と警告

## 9. 将来機能 (Future)

v1 スコープ外だが、実運用で必要になる可能性が高い機能をリストアップする。

### F-future-1: 複数 Python ファイルのモジュールバンドリング

**背景**: 実運用では Python 側にもドメインロジックが成長し、単一ファイルでは管理しきれなくなる。`engine.py` が `from utils import helper` のように内部モジュールに分割されるケースへの対応が必要。

**検討事項**:

- Worker に複数 `.py` を渡す方式（zip/tar、複数 `?raw` の結合、Pyodide の仮想ファイルシステム書き込み）
- `__bridge_sources__` のような追加ファイル指定メタデータ
- エントリポイント `.py` からの依存解析による自動収集

### F-future-2: import 文解析による依存パッケージ自動検出

**背景**: `__bridge_packages__` の手動管理が煩雑になる可能性がある。

**検討事項**:

- Python 標準ライブラリの判別（Python バージョン依存）
- Pyodide 内蔵パッケージ（numpy, scipy 等）の判別（Pyodide バージョン依存）
- 条件付き import（`try: import xxx`, `if TYPE_CHECKING:`）の扱い
- 間接依存は micropip が解決するため列挙不要

**判断**: メンテコスト（バージョン別パッケージリスト管理）が高く、`__bridge_packages__` の明示指定がシンプルかつ正確。

### F-future-3: `__bridge_packages__` のバージョン指定

**背景**: `['numpy']` だけでなく `['numpy==1.26.0']` のようなバージョン固定が必要になるケース。

### F-future-4: Pyodide 内蔵パッケージ警告

**背景**: numpy 等は Pyodide にビルトインされており micropip 不要。`__bridge_packages__` に含まれていた場合に「micropip 不要です」と警告する。

### F-future-5: React 以外のフレームワークバインディング

**背景**: Vue, Svelte, Solid 等のフレームワーク向け Hook/Composable 生成。

### F-future-6: Python ソースの Hot Module Replacement

**背景**: 開発時に Python ファイルを編集 → Worker を再初期化せず差分反映。

## 10. オープンクエスチョン

1. **Python パーサーの実装方式**: Python スクリプト（`python3` 呼び出し）か TypeScript ポートか
   - 推奨: Python スクリプトを一次パスとし、Node.js ポートは後日オプションとして追加
2. **Pyodide バージョン管理**: CDN URL にバージョンを含む。互換性マトリクスの管理は必要か
3. **生成ファイルの扱い**: コミット対象 vs ビルドアーティファクト（両方のワークフローをサポート）
4. **Worker 終了・再初期化戦略**: タイムアウト、ハートビート、グレースフルシャットダウンの範囲

## 11. 関連ドキュメント

- [ユーザープロジェクト構造ガイド](./user-project-guide.md) — pyodide-bridge を利用するプロジェクトの推奨ディレクトリ構造
