# Word学習の先生確認

## 児童の画面での操作

1. Word課題を開き、必要に応じて終了ページを入力します。
2. 「先生にみてもらう」を押します。
3. 先生が対象児童・課題・ページを確認し、自分の通常ログイン用メールアドレスとパスワードを入力します。
4. 「取り組んだ内容を確認しました」にチェックして「承認してクリア」を押します。
5. 同じ児童の画面に戻り、クリアとコインが反映されます。

児童のログアウトや先生メニューへの移動は不要です。先生認証は保存しない別のSupabaseクライアントで行います。終了時はこの一時セッションのみをログアウトし、先生が他の端末で利用中のセッションは解除しません。ブラウザ自身のパスワード保存提案はブラウザ設定に依存します。

## 権限と記録

- 生徒・未ログイン・ゲストは承認できません。ゲストの途中保存は従来どおりセッション内だけです。
- 先生は `lesson_user_access` の担当校舎・グループ等に一致する児童だけ、管理者は全体を承認できます。
- 公開ユーザーも同じ権限判定に従います。担当設定のない個人利用者については管理者による確認が必要です。
- クリア条件は既存のWord解放条件と直前の課題のクリア条件を維持します。
- 初回クリアは500コイン。再承認・連打・通信後の再試行ではコインを増やしません。旧データでクリア済みの課題も追加報酬なしで確認履歴を補います。
- 通信切断で承認結果が不明な場合、再試行できます。確認画面を閉じる場合は画面を再読み込みし、古いデータで保存結果を上書きしないようにします。
- `user_data.data.wordProgress` に状態・ページ・承認者ID・日時、`practiceLogs` に取り組みを反映します。
- 正式な承認履歴はサービス専用の `lesson_word_approvals` に保存します。通常ユーザーは直接読み書きできません。児童データ削除時に対応履歴も自動削除します。
- 既存のJSONバックアップは表示用のWord進捗を含みますが、この別テーブルは含みません。正式な承認履歴を含む復元にはSupabase側のDBバックアップも必要です。

既存の `user_data` は児童本人が自身のJSONを更新する方式です。承認履歴テーブルは保護しますが、表示用進捗全体の改ざん防止や、複数端末から古いJSONを保存する問題を一括解決する変更ではありません。

## デプロイ

リンク済みプロジェクトのPowerShellから、SQL、Function、フロントエンドの順で反映します。既存児童の移行は不要です。

```powershell
npx.cmd supabase db query --linked --file supabase/sql/word_teacher_approval.sql
npx.cmd supabase functions deploy approve-word-stage
npm.cmd run check:release
npm.cmd run build
```

Functionは既存の `LESSON_USER_DATA_TABLE` を利用します。未設定なら `user_data` です。フロントエンドと保存先が異なる要求は拒否します。サービスキーを `VITE_*` に設定しないでください。

## 検証

```powershell
npm.cmd run check:word-approval
deno check supabase/functions/approve-word-stage/index.ts
npx.cmd supabase db query --linked --file supabase/sql/verify_word_teacher_approval.sql
node scripts/verify-word-approval-live.mjs --allow-test-accounts
```

SQL検証のデータはトランザクション末尾でロールバックします。実接続検証はリンク先に一時的なAuthアカウントを作成し、終了時に削除します。実在児童は使わず、メールも送信しません。削除に失敗した場合は終了コードとメッセージで通知します。

2026-09-08: 実接続で認証、担当範囲、RLS、二重送信、並行送信、児童セッション維持、検証データ削除を確認済み。
