# 旧Dレッスン進捗データ移行手順

## 目的

旧式Dレッスンの進捗データを、新しいSupabase Auth / RLS版Dレッスンへ移します。

旧式では児童名がそのままデータIDになっています。公開URLで運用する新環境では、児童名を `user_data.id` に置かず、`student_...` の内部IDを使い、画面表示用の名前だけを `data.displayName` に残します。これにより、APIレスポンスや連携テーブルから実名が見えにくくなります。

## 移行できる主なデータ

- マウス進捗: `mouseLevel`
- キーボード進捗: `keyboardSequence`
- コイン、所持アイテム、チケット
- 生年月日、グループ、テーマ、演出、BGM
- 試験記録、苦手記録、文章課題記録
- ビジョン進捗、Dチャレンジスコア、Word進捗

旧環境には「取り組み履歴 `practiceLogs`」がないため、過去に何を何分取り組んだかの履歴は基本的に移行できません。移行後に新環境で練習した分から記録されます。

## 全体の流れ

1. 旧DレッスンでバックアップJSONを保存する。
2. 変換スクリプトで、児童名IDを `student_...` に変換する。
3. 変換後JSONを新Dレッスンのテスト環境へ復元する。
4. 児童数、名前、進捗、コイン、グループ、生年月日を確認する。
5. 問題なければ本番 `user_data` へ復元する。
6. `lesson_user_access` の児童行を、変換後の `student_...` IDへ紐づける。
7. 公開URLでログイン、表示、練習保存を確認する。

## 1. 旧Dレッスンのバックアップを保存

旧Dレッスンの管理者画面からバックアップJSONを保存します。

保存したファイル名の例:

```text
legacy-d-lesson-backup.json
```

旧Dレッスンのバックアップ機能が使えない場合は、旧環境を開いているブラウザのDevTools Consoleで次を実行し、表示されたJSONをファイルに保存します。

```js
localStorage.getItem('pc_practice_v5_split')
```

このJSONには児童名と進捗が含まれるため、メールやチャットへ貼り付けないでください。

## 2. 変換スクリプトを実行

PowerShellで新Dレッスンのフォルダへ移動します。

```powershell
cd "C:\Users\conta\Desktop\pcれんしゅう開発\Dレッスン5.0\d-lesson-v4"
```

旧バックアップを変換します。

```powershell
npm.cmd run convert:legacy-users -- --input "C:\path\to\legacy-d-lesson-backup.json" --output ".\migration\converted-users.json" --mapping ".\migration\legacy-user-map.csv"
```

出力されるファイル:

- `migration\converted-users.json`: 新Dレッスンへ復元するJSON
- `migration\legacy-user-map.csv`: 旧児童名IDと新しい `student_...` IDの対応表

`legacy-user-map.csv` は、後で `lesson_user_access` の児童アカウント紐づけに使います。

変換後に、内部ID形式へ揃っているか確認します。

```powershell
npm.cmd run check:converted-users -- --input ".\migration\converted-users.json"
```

ここで `Converted user backup check passed` と表示されれば、少なくとも旧式の児童名ID、表示名欠落、`userDataId` 不一致、重複表示名は検出されていません。

新Dレッスンの管理者画面でも、同じ種類の問題があるJSONは復元前に止まるようにしています。旧バックアップを直接復元しようとして止まった場合は、上の変換コマンドを実行してから `converted-users.json` を復元してください。

## 3. まずテスト環境へ復元

`.env.local` がテスト用になっていることを確認します。

```text
VITE_SUPABASE_TABLE=test_user_data
VITE_SUPABASE_USE_TEST_TABLE=true
VITE_ENABLE_RLS_CLOUD_SYNC=true
VITE_REQUIRE_SUPABASE_AUTH=true
```

ローカルで起動します。

```powershell
npm.cmd run dev:local
```

管理者アカウントでログインし、管理者画面のバックアップ復元から `migration\converted-users.json` を選択します。

確認すること:

- 児童数が旧環境と合っている
- 児童名が画面に正しく表示される
- 生年月日、グループが入っている
- マウスLv、キーボード％、コインが旧環境と合っている
- 代表児童で1つ練習し、進捗とコインが保存される
- Consoleにアプリ本体のエラーが出ない

## 4. 本番 `user_data` へ復元

テスト確認が済んだら、本番用の環境変数へ切り替えます。

```text
VITE_SUPABASE_TABLE=user_data
VITE_SUPABASE_USE_TEST_TABLE=false
VITE_ENABLE_RLS_CLOUD_SYNC=true
VITE_REQUIRE_SUPABASE_AUTH=true
```

本番に入れる前に、現在の本番データを管理者画面からバックアップしてください。

その後、管理者画面のバックアップ復元から `migration\converted-users.json` を復元します。

## 5. Authアカウントと児童データを紐づけ

`migration\legacy-user-map.csv` を開き、対象児童の `new_user_data_id` を確認します。

Supabase SQL Editorで、児童アカウントのAuth User IDと新しい `student_...` IDを紐づけます。

40名分を手入力するとミスが出やすいため、まずAuth User ID記入用テンプレートを作ります。

```powershell
npm.cmd run build:student-access-sql -- --mapping ".\migration\legacy-user-map.csv" --template-output ".\migration\student-auth-users-template.csv"
```

作成された `migration\student-auth-users-template.csv` を開き、各児童の `auth_user_id` を入力します。入力後は同じファイル名のまま保存してかまいません。

```text
display_name,new_user_data_id,auth_user_id,email
テスト児童A,student_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx,AUTH_USER_ID_HERE,student-a@example.com
```

保存後、Supabase SQL Editorへ貼るためのSQLを生成します。

```powershell
npm.cmd run build:student-access-sql -- --mapping ".\migration\legacy-user-map.csv" --auth ".\migration\student-auth-users-template.csv" --output ".\migration\student-access.sql"
```

`migration\student-access.sql` の中身を確認し、Supabase SQL Editorへ貼り付けて実行します。

```sql
insert into public.lesson_user_access (auth_user_id, user_data_id, role)
values
  ('STUDENT_AUTH_USER_ID_HERE', 'student_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', 'student')
on conflict (auth_user_id, user_data_id) do update
set role = excluded.role;
```

先生アカウントや管理者アカウントは、従来通り `__teacher__` / `__admin__` に紐づけます。

```sql
insert into public.lesson_user_access (auth_user_id, user_data_id, role)
values
  ('ADMIN_AUTH_USER_ID_HERE', '__admin__', 'admin'),
  ('TEACHER_AUTH_USER_ID_HERE', '__teacher__', 'teacher')
on conflict (auth_user_id, user_data_id) do update
set role = excluded.role;
```

## 6. 本番前チェック

Supabase SQL Editorで次を実行します。

```sql
supabase/sql/production_release_gate.sql
```

ファイルパスをそのままSQL Editorへ貼るのではなく、ファイルの中身を開いて貼り付けてください。

ローカルでは次を実行します。

```powershell
npm.cmd run check:release
```

GitHub Actionsへ反映後、公開URLが最新コミットか確認します。

```powershell
npm.cmd run check:public-latest
```

## 注意点

- 旧環境の児童名をそのまま `user_data.id` に入れる方法でも動作はしますが、公開運用では推奨しません。
- 変換後JSONを復元すると、復元先テーブルに存在していてJSONに存在しない児童行は削除対象になります。復元前バックアップは必須です。
- 旧GASのスプレッドシートは、移行完了後もしばらく閲覧専用バックアップとして残してください。
- 本番移行日は、旧環境での練習を止めてからバックアップを取り、そのバックアップを新環境へ入れてください。旧環境と新環境を同時に使うと進捗差分が分かれます。
