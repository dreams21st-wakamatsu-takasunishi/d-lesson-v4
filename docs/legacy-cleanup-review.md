# 旧仕様・不要要素の見直しメモ

## 今回外したもの

- 管理者画面の `マスター作成` / `マスタープレイ`
  - 旧環境では全開放ユーザーを手動作成して確認するために必要だった。
  - 現在は Supabase Auth の先生・管理者ロールで制御するため、児童データ一覧に手動のマスターユーザーを作る必要が薄い。
  - 画面ボタンと対応関数を削除し、誤操作で検証用ユーザーが混ざる余地を減らした。

- `src/ui/effects.js` の仮置き `createConfetti`
  - 一部のクリア処理やログインスタンプで、紙吹雪処理が空実装になっていた。
  - 共通実装を `src/ui/effects.js` に移し、文章練習・ログインスタンプ・メインゲームで同じ演出を使うようにした。

- `src/main.js` に残っていた旧管理画面ダッシュボード処理
  - 現在は `src/ui/admin.js` 側が画面から呼ばれる本体。
  - `main.js` 側に残っていた重複の `switchDashTab` / `updateAdminUserTable` / `renderDashboardTable` を削除した。

## 残すが、役割を明確にしておくもの

- タイトル画面の `先生用`
  - 先生・管理者が全ステージを確認するためのプレビュー導線として残す。
  - 公開URLでは Supabase Auth の `teacher` / `admin` ロールが必要。
  - 将来的には表示名を `先生用プレビュー` などに変えると、マスター作成との混同を避けやすい。

- `VITE_LEGACY_ADMIN_PASS`
  - ローカル・教室内テスト用の退避手段としてのみ残す。
  - 公開URLでは未設定にし、`VITE_ALLOW_LEGACY_ADMIN_PASS=false` にする。
  - 本番ビルドまたは `VITE_REQUIRE_SUPABASE_AUTH=true` では、値が残っていてもコード側で無効になる。

- `VITE_ENABLE_LEGACY_SUPABASE_SYNC`
  - 旧 `user_data` / `test_user_data` の直接同期を再利用するための退避設定。
  - 公開URLでは `false` 固定。
  - RLS運用が安定した段階で削除候補。

## 次に改善したいもの

- 児童名をテーブルIDとして使う設計
  - アプリ側は `displayName` / `userDataId` を持てる形に変更済み。
  - 既存行はそのまま読み、新規作成する児童は `student_...` の内部IDで保存する。
  - 管理者画面では表示名と生年月日を編集できる。
  - 既存行に表示名メタデータを入れる場合は `supabase/sql/prepare_user_display_names.sql` を実行する。
  - 名前IDの検出は `supabase/sql/verify_internal_user_ids.sql` で行う。
  - テストテーブルの移行は `supabase/sql/migrate_test_user_data_named_ids.sql` で行う。
  - 手順は [児童IDの内部ID移行手順](internal-user-id-migration.md) にまとめた。

- `__GLOBAL_SETTINGS__` をユーザーデータと同じテーブルに置く設計
  - 設定データと児童データが混ざるため、RLSや管理画面の条件が複雑になる。
  - `lesson_settings` テーブルへの任意移行SQLとアプリ側対応を追加済み。
  - `VITE_ENABLE_SETTINGS_TABLE=true` にした環境では、全体設定を `lesson_settings` から読み書きする。

- `src/main.js` に残る大きな責務
  - 画面遷移、ゲーム進行、演出、報酬表示、グローバル登録がまだ混ざっている。
  - 今回のような未定義エラーを減らすには、画面単位・機能単位で `src/ui` と `src/games` へさらに分ける。

- 旧パスワード導線の完全撤去
  - Supabase Auth の先生・管理者アカウント運用が固まったら、旧パスワード入力UIを削除する。
  - それまでは本番ビルド/Auth必須/許可フラグなしの環境で無効化する。

## 優先順

1. `verify_internal_user_ids.sql` で名前ID行を確認し、必要なら `migrate_test_user_data_named_ids.sql` でテストテーブルを内部IDへ移す。
2. 先生・管理者の画面操作を実機で確認し、旧パスワードなしで足りるか判断する。
3. `lesson_settings` をテスト環境で有効にし、旧 `__GLOBAL_SETTINGS__` 行を残したまま動作確認する。
4. `src/main.js` の巨大化を少しずつ解消する。
