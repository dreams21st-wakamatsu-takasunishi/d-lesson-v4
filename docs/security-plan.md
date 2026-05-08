# Dレッスン セキュリティ強化メモ

## いま入れた安全化

- Supabase URL / key を `src` から外し、`.env.local` で渡す形にする。
- `.env` 系ファイルを Git 管理外にする。
- 公開URLでは、旧方式の「全ユーザーを読み込む同期」を初期値で無効にする。
- 保存後に Supabase から全ユーザーを再取得する処理を止める。
- `VITE_REQUIRE_SUPABASE_AUTH=true` のとき、Supabase Auth のログイン前に名簿画面を出さない。
- Authログアウト時に、画面上に残っている学年・ユーザー一覧を消す。
- 旧管理者パスワードの入力UIと通過分岐を削除し、先生・管理者操作は Supabase Auth ロールで行う。

`.env.local` の例:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
VITE_SUPABASE_TABLE=test_user_data
VITE_ENABLE_LEGACY_SUPABASE_SYNC=false
VITE_REQUIRE_SUPABASE_AUTH=true
```

`VITE_ENABLE_LEGACY_SUPABASE_SYNC=true` は、ローカルや教室内テストなど信頼できる環境だけで使う。
公開URLでは `false` のままにする。

公開URLでは `VITE_REQUIRE_SUPABASE_AUTH=true` にする。
この設定を入れると、先生または管理者の Supabase Auth アカウントでログインするまで、アプリ内の名簿は表示されない。

旧管理者パスワード関連の `VITE_` 変数は公開URLでは設定しない。
`VITE_` 変数はビルド後のJavaScriptに含まれるため、認可は Supabase Auth と RLS に寄せる。

## 現在のリスク

- 旧データ構造は `user_data` の各行に児童名を `id` として持っている。アプリ側は `displayName` と内部IDを分ける準備済み。
- 旧起動導線は、ログイン前に全児童データを読み込んで学年・名前を表示する。
- 管理者操作はAuthロール前提に移行済みだが、DB側の保護としてRLS設定を必ず維持する。
- `localStorage` には端末で読める形のデータが残る。
- 現段階の Auth ゲートは入口ロックであり、DB側の本格制御は RLS 設定が必要。

## 公開URL化の前に必要な設計

1. Supabase Auth を入れる。
2. 児童・先生・管理者を Auth ユーザーに紐づける。
3. 新規児童は `student_...` の内部IDで作成し、画面表示は `data.displayName` を使う。
4. RLSで「児童は自分だけ」「先生は担当分だけ」「管理者は全体」を制御する。
5. 管理者操作は、ブラウザ内パスワードではなく Auth ロールで行う。より厳密にする場合は Edge Function 経由も検討する。

## 次に行うとよいこと

1. Supabase の Authentication で先生・管理者用アカウントを作る。
2. 公開URL用の `.env.local` では `VITE_REQUIRE_SUPABASE_AUTH=true` にする。
3. `supabase/sql/rls_legacy_user_data_baseline.sql` を実行する前に、Authユーザーとアクセス対応表を準備する。
4. 既存行には `supabase/sql/prepare_user_display_names.sql` で `displayName` / `userDataId` を追加し、必要に応じて `verify_internal_user_ids.sql` と `migrate_test_user_data_named_ids.sql` で内部IDへ移す。
5. 先生・管理者操作をAuthロールで確認し、RLSで権限外操作が拒否されることを確認する。

## 参考資料

- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API keys: https://supabase.com/docs/guides/api/api-keys
- Supabase Auth: https://supabase.com/docs/guides/auth
