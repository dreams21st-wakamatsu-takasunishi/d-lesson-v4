# 仕様・保守手引書

## アプリ概要

Dレッスンは、小学生向けのPC練習アプリです。

主な練習:

- マウス練習
- キーボード練習
- 文章練習
- ことば入力
- ビジョントレーニング
- ガチャ
- 記録確認

主な管理機能:

- 児童追加・編集・削除
- 進捗編集
- コイン付与
- 児童レポート
- 取り組み履歴
- バックアップ保存
- バックアップ復元
- Auth連携
- 先生担当範囲設定
- 運用設定

## 画面構成

### 未ログイン

- ログイン画面だけを表示する。
- 児童名一覧は表示しない。

### 児童ログイン後

- 本人の練習メニューへ進む。
- 他児童の名前や進捗は表示しない。

### 先生ログイン後

- 先生用プレビューを表示する。
- 担当範囲の児童だけ確認できる。
- 先生確認モードでは児童データを保存変更しない。

### 管理者ログイン後

- 管理者画面を表示できる。
- 児童データ、Auth連携、バックアップ、復元、設定を扱える。

## データ保存

主な保存先:

- `user_data`: 本番児童データ
- `test_user_data`: 検証用児童データ
- `lesson_user_access`: AuthユーザーとDレッスンデータの紐づけ
- `lesson_settings`: 全体設定の任意保存先

児童データの考え方:

- `user_data.id`: 内部ID。原則 `student_...`。
- `data.displayName`: 画面表示名。
- `data.birthdate`: 生年月日。
- `data.group`: 所属グループ。
- `data.coins`: コイン。
- `data.mouseLevel`: マウスLv。
- `data.keyboardSequence`: キーボード進捗。
- `data.examRecords`: ビジョンなどの記録。
- `data.textRecords`: 文章練習記録。
- `data.practiceLogs`: 取り組み履歴。

## Auth連携

`lesson_user_access` の主な列:

- `auth_user_id`: Supabase Auth User ID
- `user_data_id`: `user_data.id`
- `role`: `student`、`teacher`、`admin`
- `scope_type`: `all` または `group`
- `scope_value`: グループ名など

## 環境変数

本番公開URLでは次を使います。

```text
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
VITE_SUPABASE_TABLE=user_data
VITE_SUPABASE_USE_TEST_TABLE=false
VITE_ENABLE_LEGACY_SUPABASE_SYNC=false
VITE_ENABLE_RLS_CLOUD_SYNC=true
VITE_ENABLE_SETTINGS_TABLE=true または false
VITE_REQUIRE_SUPABASE_AUTH=true
```

本番公開URLに設定しないもの:

```text
VITE_LEGACY_ADMIN_PASS
VITE_ENABLE_LEGACY_SUPABASE_SYNC=true
VITE_ALLOW_LEGACY_ADMIN_PASS=true
```

## ローカル起動

```powershell
cd "C:\Users\conta\Desktop\pcれんしゅう開発\Dレッスン5.0\d-lesson-v4"
npm.cmd install
npm.cmd run dev:local
```

URL:

```text
http://127.0.0.1:5174/
```

## 公開手順

1. ローカルで確認する。
2. `npm.cmd run check:release` を実行する。
3. 変更をcommitする。
4. GitHubへpushする。
5. GitHub Actionsのデプロイ完了を確認する。
6. 公開URLで確認する。
7. `npm.cmd run check:public-latest` を実行する。

commit例:

```powershell
git status
git add .
git commit -m "運用手引書を追加"
git push
```

## 主要チェックコマンド

公開前の総合チェック:

```powershell
npm.cmd run check:release
```

公開URLが最新コミットまで反映済みか確認:

```powershell
npm.cmd run check:public-latest
```

公開URLが本番テーブルを見ているか確認:

```powershell
npm.cmd run check:public-production-url
```

未定義エラーの静的確認:

```powershell
npm.cmd run check:undefined
```

インラインハンドラ確認:

```powershell
npm.cmd run check:inline-handlers
```

ビルド:

```powershell
npm.cmd run build
```

## 保守方針

- 管理画面の大きな機能は、表示処理とデータ整形処理を分ける。
- データ整形処理は `scripts/check-...` で確認できるようにする。
- 実操作でしか拾えないエラーは、ローカルまたは公開URLでConsoleを確認する。
- 児童情報を含むCSV、JSON、バックアップはGitに入れない。
- 旧式パスワードや旧式全件同期は、本番公開URLでは使わない。

## 関連資料

- [公開前チェックリスト](../public-release-checklist.md)
- [本番公開ランブック](../production-release-runbook.md)
- [Supabase Auth / RLS 設定手順](../supabase-rls-setup.md)
- [旧Dレッスン進捗データ移行手順](../legacy-d-lesson-data-migration.md)
- [lesson_settings 移行手順](../lesson-settings-table.md)

