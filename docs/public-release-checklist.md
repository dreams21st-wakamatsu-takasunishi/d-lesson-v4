# 公開・現場運用前チェックリスト

## 目的

Dレッスンをインターネット公開、または現場運用に近い形で使う前に、最低限確認する項目をまとめる。

## 現時点の判定

- ローカル動作確認: 進行可能
- GitHub Pages 公開: 進行可能
- `user_data` を使った公開確認: 進行可能
- 実名の児童データを入れた現場運用: 最終の手動確認とバックアップ運用確認後に進行可能

実名データを扱う公開運用では、Supabase Auth、RLS、アクセス権限、バックアップ復元、先生確認モードの保存防止を最後にもう一度確認する。

## 公開前に必ず満たす条件

### 1. 環境変数

公開URL用の `.env.local` またはホスティング環境変数では、次を必ず確認する。

テストテーブルで公開検証する場合:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
VITE_SUPABASE_TABLE=test_user_data
VITE_SUPABASE_USE_TEST_TABLE=true
VITE_ENABLE_LEGACY_SUPABASE_SYNC=false
VITE_ENABLE_RLS_CLOUD_SYNC=true
VITE_ENABLE_SETTINGS_TABLE=false
VITE_REQUIRE_SUPABASE_AUTH=true
VITE_ALLOW_LEGACY_ADMIN_PASS=false
```

本番 `user_data` で公開する場合:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
VITE_SUPABASE_TABLE=user_data
VITE_SUPABASE_USE_TEST_TABLE=false
VITE_ENABLE_LEGACY_SUPABASE_SYNC=false
VITE_ENABLE_RLS_CLOUD_SYNC=true
VITE_ENABLE_SETTINGS_TABLE=true または false
VITE_REQUIRE_SUPABASE_AUTH=true
VITE_ALLOW_LEGACY_ADMIN_PASS=false
```

公開URLでは、次を設定しない。

```env
VITE_LEGACY_ADMIN_PASS=
```

理由: Vite の `VITE_` 変数はビルド後のJavaScriptに含まれるため、公開URLでは管理者パスワードを守る仕組みにならない。
コード側でも、本番ビルドまたは `VITE_REQUIRE_SUPABASE_AUTH=true` の環境では旧パスワードを無効化している。

RLS設定とアクセス権限の検証が終わった後だけ、クラウド同期を有効にする。

```env
VITE_ENABLE_RLS_CLOUD_SYNC=true
```

### 2. Supabase

- Supabase Auth のアカウントを用意する。
- `lesson_user_access` に、Authユーザーとアクセス可能なデータIDを紐づける。
- `supabase/sql/rls_legacy_user_data_baseline.sql` を本番前の検証環境で試す。
- 管理者画面の「Auth連携」を使う場合は、`supabase/sql/admin_lesson_user_access_policies.sql` も実行する。
- 管理者画面の児童削除・バックアップ復元を使う場合は、`supabase/sql/admin_user_data_delete_policies.sql` も実行する。
- 先生アカウントの担当範囲をグループで制限する場合は、`supabase/sql/teacher_group_scope_policies.sql` を実行し、`docs/teacher-scope-setup.md` に沿って確認する。
- 全体設定を児童テーブルから分ける場合は、`supabase/sql/lesson_settings_table.sql` を実行し、`docs/lesson-settings-table.md` に沿って確認する。
- 詳細手順は [Supabase Auth / RLS 設定手順](supabase-rls-setup.md) に沿って確認する。
- RLS有効後、未ログイン状態でデータが読めないことを確認する。
- 生徒アカウントで、他の生徒データが読めないことを確認する。
- 先生アカウントで、必要な範囲だけ読めること、児童データを書き換えないことを確認する。
- 管理者アカウントで、必要な管理操作だけできることを確認する。

### 3. データ

- 実名データは、公開設定が完了するまで入れない。
- テスト公開では、児童名を仮名にする。
- 新規児童は `student_...` の内部IDで保存し、画面表示名は `data.displayName` を使う。
- 既存の名前ID行には、必要に応じて `supabase/sql/prepare_user_display_names.sql` で表示名メタデータを追加する。
- 実名投入前に `supabase/sql/verify_internal_user_ids.sql` で名前ID行を確認し、必要なら [児童IDの内部ID移行手順](internal-user-id-migration.md) に沿って移行する。
- バックアップ・復元の操作ログと復元前自動バックアップを確認してから本番運用へ移る。

### 4. ブラウザ動作確認

[実操作時の未定義エラー確認手順](runtime-undefined-checklist.md) に沿って確認する。

現場運用前の残タスクは [現場運用開始までの残タスク](field-operations-readiness.md) に沿って確認する。
端末切替時の確認は [端末切替・同期確認手順](device-handoff-guide.md) に沿って確認する。

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
- バックアップ保存
- バックアップ復元
- 先生確認モードでの保存防止

Consoleに次が出た場合は公開しない。

- `ReferenceError`
- `is not defined`
- `Cannot access ... before initialization`
- アプリ本体ファイルで発生する `TypeError`
- Supabaseの認証・RLSエラー

`content.js: The message port closed before a response was received` は、ブラウザ拡張由来の可能性が高いため、単独発生ならアプリ本体の公開停止理由にはしない。

### 5. 公開前envチェック

テストテーブルで公開検証する場合は、次を実行する。

```powershell
npm.cmd run check:public-test-env
```

実名データを入れる本番 `user_data` へ移る場合は、次を実行する。

```powershell
npm.cmd run check:public-env
```

`check:public-test-env` は `test_user_data` を許可する。`check:public-env` は `test_user_data` のままだと失敗するため、実名運用前の切り替え漏れを検出できる。

本番 `user_data` へ移る前に、Supabase SQL Editor で次のSQLも実行する。

```sql
supabase/sql/preflight_public_release.sql
```

`result` が `NG` の行がある場合は公開しない。特に `user_data_legacy_name_ids` と `lesson_user_access_legacy_refs` は、実名がDB行IDやAuth連携IDに残っていないかを確認する。

公開後、GitHub Pages に最新コミットが反映されたか確認する。

```powershell
npm.cmd run check:public-latest
```

### 6. ビルド

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
- `npm.cmd run check:public-test-env` または `npm.cmd run check:public-env` が成功する。
- `npm.cmd run check:public-latest` が成功する。
- 本番 `user_data` へ移る場合は `supabase/sql/preflight_public_release.sql` に `NG` がない。
- 実操作チェックでアプリ本体の赤いConsoleエラーがない。
- 公開URLで `VITE_REQUIRE_SUPABASE_AUTH=true` になっている。
- 公開URLで `VITE_ENABLE_LEGACY_SUPABASE_SYNC=false` になっている。
- 公開URLで `VITE_ALLOW_LEGACY_ADMIN_PASS=false` になっている。
- `VITE_ENABLE_SETTINGS_TABLE=true` にする場合は、`lesson_settings` のRLS確認が終わっている。
- 設定テーブル分離を使う場合は、`supabase/sql/verify_lesson_settings.sql` で診断済み。
- Supabaseへ保存・読込する場合は、RLS検証後に `VITE_ENABLE_RLS_CLOUD_SYNC=true` になっている。
- 公開URLに `VITE_LEGACY_ADMIN_PASS` を設定していない。
- RLSにより、未ログイン・権限外ユーザーがデータを読めない。

### 公開を止める状態

- 実名データを入れているが、Auth/RLSが未完成。
- 管理者パスワードをフロントエンド環境変数に入れている。
- `VITE_ALLOW_LEGACY_ADMIN_PASS=true` を公開URLに設定している。
- 旧方式の全ユーザー同期が公開URLで有効。
- Consoleにアプリ本体の `ReferenceError` が出る。
- テストユーザー以外のデータを使って検証している。

## 次に実装する候補

1. Auth連携画面で、児童・先生・追加管理者の紐づけ操作を現場手順として確認する。
2. 管理者操作をブラウザ内パスワードではなく、Authロールまたはサーバー側処理に移す。
3. 既存の名前ID行を内部IDへ移行するか、移行せず互換運用にするかを決める。
4. 実名データ投入前に、バックアップ・復元・復元前自動バックアップを1回ずつテストする。
5. 公開URLでのSupabase Auth/RLS疎通テストを行う。
