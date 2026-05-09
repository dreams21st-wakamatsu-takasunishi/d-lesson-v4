# トラブル対応手引書

## まず確認すること

1. どのURLで起きているか。
   - 公開URL。
   - ローカルURL。
2. どのアカウントで起きているか。
   - 児童。
   - 先生。
   - 管理者。
3. 何をした直後に起きたか。
4. Consoleに何が出ているか。
5. 再読み込み後も起きるか。

## Consoleで見るもの

重要:

- `ReferenceError`
- `is not defined`
- `Cannot access ... before initialization`
- `Cannot read properties of undefined`
- Supabase Authエラー
- RLSエラー

単独ならアプリ本体の問題ではない可能性が高いもの:

- `content.js`
- `The message port closed before a response was received`
- `A listener indicated an asynchronous response by returning true...`

これらはブラウザ拡張機能由来のことがあります。  
ただし、同時にアプリ本体のエラーが出ている場合は、そのエラーを優先して確認します。

## ログインできない

### 児童ログイン

確認:

- 児童番号が正しい。
- あいことばが正しい。
- Supabase Authに児童アカウントが存在する。
- `lesson_user_access` に対象Auth User IDと `user_data_id` が登録されている。
- `user_data_id` が実際の `user_data.id` と一致している。

対応:

1. 管理者画面のAuth連携を確認する。
2. Supabase AuthenticationでAuth User IDを確認する。
3. 必要なら児童のパスワードを再設定する。
4. ログインカードを再発行する。

### 先生・管理者ログイン

確認:

- メールアドレスとパスワードが正しい。
- Supabase Authアカウントが存在する。
- `lesson_user_access` に `teacher` または `admin` として登録されている。

## ログイン後に児童が表示されない

確認:

- `lesson_user_access.user_data_id` が正しい。
- 対象の `user_data` 行が存在する。
- RLSが正しく設定されている。
- 公開URLが `user_data` を見ている。
- テスト中なら `test_user_data` を見ている。

実行する確認:

```powershell
npm.cmd run check:public-production-url
```

Supabase SQLでは、関連する検証SQLを実行します。

- `supabase/sql/verify_rls_access.sql`
- `supabase/sql/preflight_public_release.sql`

## 先生に見える範囲がおかしい

確認:

- 先生の `scope_type` が `all` か `group` か。
- `scope_value` と児童の `group` が完全一致しているか。
- グループ名に余分な空白がないか。
- 管理者画面で先生を再登録したか。

対応:

1. 管理者画面 > Auth連携を開く。
2. 先生Auth User IDを確認する。
3. 担当範囲を設定し直す。
4. 先生でログインし直す。

## 練習後に保存されない

確認:

- 児童本人のアカウントでログインしているか。
- 先生確認モードではないか。
- 通信が切れていないか。
- Supabase RLSエラーが出ていないか。
- 再読み込み後に進捗が残っているか。

切り分け:

1. 操作前コインと進捗をメモする。
2. 練習を1つクリアする。
3. 操作直後のコインと進捗を見る。
4. 画面を再読み込みする。
5. 再読み込み後のコインと進捗を見る。

児童本人で保存されない場合は修正対象です。  
先生アカウントで保存されないのは正常です。

## コインは増えるが進捗が変わらない

確認:

- その練習が進捗対象か。
- クリア条件を満たしているか。
- `markClear` 付近のConsoleエラーが出ていないか。
- `getPracticeTitle` やステージ定義の未定義エラーがないか。

対応:

```powershell
npm.cmd run check:undefined
npm.cmd run check:release
```

## 管理者画面の削除・復元が反映されない

確認:

- 管理者アカウントでログインしているか。
- RLSの管理者削除ポリシーが入っているか。
- 復元後に画面を再読み込みしたか。
- 旧データがSupabaseに残っていないか。

必要なSQL:

- `supabase/sql/admin_user_data_delete_policies.sql`

## 公開URLが古い

確認:

1. GitHubにpushしたか。
2. GitHub Actionsのデプロイが完了しているか。
3. ブラウザキャッシュが残っていないか。
4. 公開URLのアセットが404になっていないか。

確認コマンド:

```powershell
npm.cmd run check:public-latest
```

古い画面が出る場合:

- Actions完了を待つ。
- Ctrl + F5で再読み込みする。
- 別ブラウザで確認する。
- `check:public-latest` の結果を見る。

## ビルドは通るが画面操作でエラーが出る

ビルドでは拾えない、実操作時だけ出る未定義があります。  
次を確認します。

- タイトル画面。
- 児童ログイン。
- 先生ログイン。
- 管理者ログイン。
- マウス練習。
- キーボード練習。
- 文章練習。
- ことば入力。
- ビジョントレーニング。
- ガチャ。
- 管理者画面の各タブ。
- バックアップ保存。
- バックアップ復元。

Consoleに出たエラーは、次の形で記録します。

```text
操作:
アカウント:
発生画面:
Consoleエラー:
再現手順:
再読み込み後も出るか:
```

## 本番運用を止める目安

次の場合は、公開運用を止めて確認してください。

- 児童が他児童の名前や進捗を見られる。
- 未ログインで児童名一覧が見える。
- 先生が担当外児童を見られる。
- 先生操作で児童データが保存変更される。
- 管理者以外が削除・復元・設定変更できる。
- 児童本人の練習結果が保存されない。
- Supabase RLSエラーが継続する。
- 公開URLでアプリ本体由来の `ReferenceError` が出る。

