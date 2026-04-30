# 公開・現場運用前チェックリスト

## 目的

Dレッスンをインターネット公開、または現場運用に近い形で使う前に、最低限確認する項目をまとめる。

## 現時点の判定

- ローカル動作確認: 進行可能
- テストデータでの限定公開: 条件付きで進行可能
- 実名の児童データを入れた公開運用: まだ不可

実名データを扱う公開運用では、Supabase Auth、RLS、アクセス権限設計を完了してから進める。

## 公開前に必ず満たす条件

### 1. 環境変数

公開URL用の `.env.local` またはホスティング環境変数では、次を必ず確認する。

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
VITE_SUPABASE_TABLE=test_user_data
VITE_SUPABASE_USE_TEST_TABLE=true
VITE_ENABLE_LEGACY_SUPABASE_SYNC=false
VITE_ENABLE_RLS_CLOUD_SYNC=false
VITE_REQUIRE_SUPABASE_AUTH=true
```

公開URLでは、次を設定しない。

```env
VITE_LEGACY_ADMIN_PASS=
```

理由: Vite の `VITE_` 変数はビルド後のJavaScriptに含まれるため、公開URLでは管理者パスワードを守る仕組みにならない。

RLS設定とアクセス権限の検証が終わった後だけ、クラウド同期を有効にする。

```env
VITE_ENABLE_RLS_CLOUD_SYNC=true
```

### 2. Supabase

- Supabase Auth のアカウントを用意する。
- `lesson_user_access` に、Authユーザーとアクセス可能なデータIDを紐づける。
- `supabase/sql/rls_legacy_user_data_baseline.sql` を本番前の検証環境で試す。
- 詳細手順は [Supabase Auth / RLS 設定手順](supabase-rls-setup.md) に沿って確認する。
- RLS有効後、未ログイン状態でデータが読めないことを確認する。
- 生徒アカウントで、他の生徒データが読めないことを確認する。
- 先生アカウントで、必要な範囲だけ読めることを確認する。
- 管理者アカウントで、必要な管理操作だけできることを確認する。

### 3. データ

- 実名データは、公開設定が完了するまで入れない。
- テスト公開では、児童名を仮名にする。
- `user_data.id` に児童名を直接使う構造は、将来的にUID形式へ移行する。
- バックアップ手順を決めてから本番運用へ移る。

### 4. ブラウザ動作確認

[実操作時の未定義エラー確認手順](runtime-undefined-checklist.md) に沿って確認する。

公開前に最低限確認する操作:

- 初期表示
- Supabase Auth ログイン
- ログアウト
- 生徒ログイン
- 先生ログイン
- マウス練習
- キーボード練習
- テキスト練習
- ことば入力
- ビジョントレーニング
- ガチャ
- 記録画面
- 管理者画面
- 進捗編集
- チケット設定

Consoleに次が出た場合は公開しない。

- `ReferenceError`
- `is not defined`
- `Cannot access ... before initialization`
- アプリ本体ファイルで発生する `TypeError`
- Supabaseの認証・RLSエラー

`content.js: The message port closed before a response was received` は、ブラウザ拡張由来の可能性が高いため、単独発生ならアプリ本体の公開停止理由にはしない。

### 5. ビルド

公開前に必ず実行する。

```powershell
npm.cmd run build
```

必要に応じて本番ビルドをローカル確認する。

```powershell
npm.cmd run preview
```

## 公開判定

### 公開してよい状態

- `npm.cmd run build` が成功する。
- 実操作チェックでアプリ本体の赤いConsoleエラーがない。
- 公開URLで `VITE_REQUIRE_SUPABASE_AUTH=true` になっている。
- 公開URLで `VITE_ENABLE_LEGACY_SUPABASE_SYNC=false` になっている。
- Supabaseへ保存・読込する場合は、RLS検証後に `VITE_ENABLE_RLS_CLOUD_SYNC=true` になっている。
- 公開URLに `VITE_LEGACY_ADMIN_PASS` を設定していない。
- RLSにより、未ログイン・権限外ユーザーがデータを読めない。

### 公開を止める状態

- 実名データを入れているが、Auth/RLSが未完成。
- 管理者パスワードをフロントエンド環境変数に入れている。
- 旧方式の全ユーザー同期が公開URLで有効。
- Consoleにアプリ本体の `ReferenceError` が出る。
- テストユーザー以外のデータを使って検証している。

## 次に実装する候補

1. Authユーザーと児童データを紐づける管理画面またはSQL運用手順を整える。
2. 管理者操作をブラウザ内パスワードではなく、Authロールまたはサーバー側処理に移す。
3. `user_data.id` を児童名からUIDへ移行する。
4. 実名データ投入前のバックアップ・復元手順を作る。
5. 公開URLでのSupabase Auth/RLS疎通テストを行う。
