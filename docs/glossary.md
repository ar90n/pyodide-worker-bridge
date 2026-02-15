# 用語集: pyodide-bridge

## A

### AST (Abstract Syntax Tree)

プログラムのソースコードを木構造で表現したもの。pyodide-bridge では Python の `ast` モジュールを使って Python ソースをパースし、型定義や関数シグネチャを抽出する。

## B

### BridgeError

pyodide-bridge が定義する構造化エラークラス。Python 側がエラー辞書パターン `{"error": {"code": "...", "message": "..."}}` を返した場合に、ランタイムが検出して throw する。`code` プロパティでエラー種別を区別できる。

### Bridge Exports (`__bridge_exports__`)

Python モジュール内で定義するリスト変数。TypeScript 側に公開する関数名を列挙する。この変数に含まれる関数のみがブリッジ対象となる。

### Bridge Packages (`__bridge_packages__`)

Python モジュール内で定義するリスト変数。Pyodide の micropip でインストールすべき Python パッケージ名を列挙する。Worker 初期化時に自動インストールされる。

### Bundler Adapter

バンドラー（Vite, Webpack, Inline）ごとに異なる Python ソース読み込み方法と Worker 生成方法を抽象化するパターン。生成される `.worker.ts` のコードがバンドラーに応じて変わる。

## C

### Comlink

Google が開発した Web Worker 通信ライブラリ。`Comlink.wrap()` でメインスレッドから Worker の API を透過的に呼び出せる。pyodide-bridge はこれを利用して Python 関数への型安全なプロキシを提供する。

### Comlink Proxy

`Comlink.wrap()` が返すプロキシオブジェクト。`typeof` が `'function'` となるため、React の `setState` が updater function と誤認する問題がある。`wrapProxy()` でオブジェクトにラップして回避する。

## D

### deepConvertMaps

Pyodide の `toJs()` が返す ES6 `Map` オブジェクトを再帰的に plain JavaScript object に変換するランタイムユーティリティ関数。

## E

### Emitter

Module IR を入力として TypeScript ソースコードを文字列として生成するコンポーネント。Types Emitter、Worker Emitter、Hooks Emitter の 3 種類がある。

## H

### Hook (React Hook)

React のステート管理パターン。pyodide-bridge では `usePyodide`（Worker ライフサイクル管理）と関数別 Hook（`useXxx`）を生成する。

## I

### IR (Intermediate Representation / 中間表現)

→ Module IR を参照。

## M

### micropip

Pyodide 内蔵のパッケージマネージャー。pure-Python パッケージをブラウザ環境にインストールできる。`__bridge_packages__` で指定されたパッケージのインストールに使用される。

### Module IR (Module Intermediate Representation)

Python パーサーが出力し、各エミッターが消費する中間データ構造。モジュール名、型定義（TypeDictNode, LiteralAliasNode）、関数定義（FunctionNode）、依存パッケージを含む JSON 形式のデータ。

## P

### Pyodide

Python インタープリター (CPython) を WebAssembly にコンパイルしたもの。ブラウザ上で Python コードを直接実行できる。pyodide-bridge はこれを Web Worker 内で使用する。

### Python Parser (parser.py)

Python の `ast` モジュールを使って Python ソースファイルを解析し、Module IR を JSON として出力するスクリプト。CLI が `python3` 子プロセスとして呼び出す。

## T

### TypedDict

Python の `typing` モジュールが提供する辞書型。フィールド名と型を静的に定義できる。pyodide-bridge はこれを TypeScript の型定義（interface 相当）に変換する。`total=True`（デフォルト）で全フィールド必須、`total=False` で全フィールドオプショナルとなる。

### Type Mapping (型マッピング)

Python の型アノテーションを TypeScript の型に変換するルール。例: `int` → `number`, `str` → `string`, `list[T]` → `T[]`, `TypedDict` → オブジェクト型。

### TypeRef

Module IR 内で型を表現するデータ構造。プリミティブ、リスト、辞書、Optional、Literal、参照（同一モジュール内の型名）の 6 種類がある。

## U

### usePyodide

pyodide-bridge が提供する React Hook。Web Worker の生成、Pyodide の初期化、ステータス管理（loading / ready / error）、再試行機能を提供する。

## W

### Web Worker

ブラウザのメインスレッドとは別のスレッドでスクリプトを実行する仕組み。Pyodide の初期化や Python 実行がメインスレッドをブロックしないよう、pyodide-bridge は Worker 内で Pyodide を動作させる。

### Worker Bootstrap

Web Worker 内で Pyodide をロード・初期化する一連の処理。CDN からの Pyodide ダウンロード、micropip によるパッケージインストール、Python ソースの実行を含む。
