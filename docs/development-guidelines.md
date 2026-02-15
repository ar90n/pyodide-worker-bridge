# 開発ガイドライン: pyodide-bridge

## 1. 技術スタック

| カテゴリ               | 技術       | バージョン |
| ---------------------- | ---------- | ---------- |
| 言語                   | TypeScript | 5.x        |
| ランタイム             | Node.js    | 18+        |
| パッケージマネージャー | npm        | 10+        |
| バンドラー             | tsup       | latest     |
| テスト                 | Vitest     | latest     |
| フォーマッター         | Prettier   | latest     |
| Python パーサー        | Python     | 3.10+      |
| Python テスト          | pytest     | latest     |

## 2. コーディング規約

### TypeScript

- **モジュール形式**: ESM (`import`/`export`)
- **ターゲット**: ES2022
- **strict モード**: 有効
- **命名規則**:
  - 変数・関数: `camelCase`
  - 型・インターフェース: `PascalCase`
  - 定数: `UPPER_SNAKE_CASE`（モジュールレベルの真の定数のみ）
  - ファイル名: `kebab-case.ts`
- **型**: `any` の使用禁止。`unknown` を使い、型ガードで絞り込む
- **エクスポート**: 名前付きエクスポートのみ使用。デフォルトエクスポート禁止（`index.ts` の re-export を除く）
- **nullable**: `null` と `undefined` を区別する。API の戻り値には `null`、オプショナルフィールドには `undefined`

### Python (parser.py)

- **バージョン**: 3.10+
- **型ヒント**: 全関数に型アノテーション
- **docstring**: Google スタイル
- **外部依存**: 標準ライブラリのみ（`ast`, `json`, `sys`, `typing`）

## 3. ブランチ戦略

| ブランチ                  | 用途                                     |
| ------------------------- | ---------------------------------------- |
| `main`                    | リリースブランチ。常にリリース可能な状態 |
| `feat/<feature-name>`     | 機能開発ブランチ                         |
| `fix/<issue-description>` | バグ修正ブランチ                         |
| `chore/<description>`     | 設定変更・リファクタリング               |

- `main` への直接コミットは禁止
- PR はスカッシュマージ

## 4. コミット規約

[Conventional Commits](https://www.conventionalcommits.org/) に従う。

```
<type>(<scope>): <description>

[optional body]
```

**type**:
| type | 説明 |
|------|------|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `docs` | ドキュメント |
| `test` | テスト追加・修正 |
| `refactor` | リファクタリング |
| `chore` | ビルド・設定変更 |

**scope**: `cli`, `runtime`, `react`, `parser`, `docs`

**例**:

```
feat(cli): add --check mode for CI validation
fix(runtime): handle nested Map in deepConvertMaps
test(parser): add fixture for TypedDict with total=False
```

## 5. テストガイドライン

### テスト配置

- TypeScript テスト: `tests/` ディレクトリ（ソースと同じ階層構造）
- Python テスト: `parser/test_parser.py`
- フィクスチャ: `tests/fixtures/`

### テスト実行

```bash
# 全テスト実行
npm test

# 特定のテストファイル
npm test -- tests/runtime/deep-convert.test.ts

# ウォッチモード
npm run test:watch

# カバレッジ
npm run test:coverage

# Python パーサーテスト
cd parser && python -m pytest test_parser.py -v
```

### テスト命名

```typescript
describe('deepConvertMaps', () => {
  it('converts a flat Map to a plain object', () => { ... })
  it('recursively converts nested Maps', () => { ... })
  it('preserves arrays with Map elements', () => { ... })
  it('returns primitives unchanged', () => { ... })
})
```

### スナップショットテスト

エミッターのテストではスナップショットテストを使用する。

```typescript
it("generates correct types from simple TypedDict", () => {
  const ir = parseFixture("simple.py");
  const output = emitTypes(ir);
  expect(output).toMatchSnapshot();
});
```

スナップショットの更新:

```bash
npm test -- --update
```

## 6. ビルド

```bash
# ビルド
npm run build

# 型チェック
npm run typecheck
```

**tsup 設定のポイント**:

- エントリポイント: `src/index.ts`, `src/runtime/index.ts`, `src/react/index.ts`, `src/cli/bin.ts`
- 出力形式: ESM
- 型定義生成: 有効 (`dts: true`)
- `parser.py` は postbuild スクリプトで `dist/parser/` にコピー

## 7. 依存関係管理

### 依存追加時のルール

1. **Runtime 依存は最小限に**: `dependencies` に追加するパッケージは極力避ける
2. **Peer dependency**: `comlink`, `react` はピア依存として宣言
3. **devDependencies**: ビルド・テスト・開発ツールのみ
4. **ロックファイル**: `package-lock.json` をコミット

### Python 依存

- `parser.py` は **標準ライブラリのみ** を使用する（外部パッケージ不要）
- テスト用の `pytest` は開発時のみ

## 8. エラーハンドリングパターン

### CLI

```typescript
// CLI はプロセス終了コードでエラーを伝える
try {
  await generate(config);
} catch (err) {
  if (err instanceof PythonParseError) {
    console.error(`Parse error in ${err.file}:${err.line}: ${err.message}`);
    process.exit(1);
  }
  // 予期しないエラー
  console.error("Unexpected error:", err);
  process.exit(2);
}
```

### Runtime

```typescript
// BridgeError はユーザーが catch できる構造化エラー
class BridgeError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "BridgeError";
  }
}
```

### React Hooks

```typescript
// Hook はエラーを state として公開する (throw しない)
const { result, error, isLoading } = useMyFunction(api, status);
if (error) {
  // error は BridgeError | Error
}
```

## 9. コードレビュー基準

PR レビュー時のチェックポイント:

- [ ] 型安全性: `any` が使われていないか
- [ ] テスト: 新規コードにテストがあるか
- [ ] エラーハンドリング: エラーケースが適切に処理されているか
- [ ] 命名: 規約に従っているか
- [ ] ドキュメント: 公開 API に JSDoc があるか
- [ ] 後方互換性: 既存 API の破壊的変更がないか

## 10. リリースフロー

1. `main` からリリースブランチを作成（不要、main が常にリリース可能）
2. バージョンを `package.json` で更新
3. `npm run build && npm test` で検証
4. git tag を作成
5. GitHub Actions がタグプッシュで `npm publish` を実行
