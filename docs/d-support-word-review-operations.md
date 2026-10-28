# DサポートへのWord確認申請

## 紙のテキストでの運用（2026-10-28）

教材のデータファイル化が認められていないため、教材PDFの閲覧・Drive連携方針を撤回した。Word練習は現物の本を使用し、章ごとに本の到達ページを入力して「ページをきろく」で保存する。次回は前の到達ページを表示する。既存の `wordProgress[stageId].page` と学習履歴を継続利用し、進捗IDやクリア・承認状態はリセットしない。ページは1〜9999の整数を必須とし、教材のPDFページ番号ではなく本の印刷ページ番号を記録する。

ページ保存だけではクリア・コイン付与・先生への申請は行わない。「先生にみてもらう」からの児童自身の作品PDF・画像の提出、Dサポートでの通知・承認・差し戻しは維持する。教材のスキャンや教材PDFを作品としてアップロードする運用は行わない。作品自体の共有可否も教材の利用条件に従って確認する。

教材PDFを開くボタンを撤去し、過去の `openWordText()` 呼び出しにも紙のテキストの案内だけを返す。認証・成果物Storage・承認Functionの仕様は変更しない。

2026-09-30: Dサポートと本人確認済みで連携した教室児童は、PDF・PNG・JPEGの作品（8MB以下）を児童画面から申請する。Dサポートのアプリ内通知、職員の承認・理由付き差し戻し、児童画面での結果確認・再申請を実装した。

作品は非公開Storage `lesson-word-work` に保存し、児童本人と連携先の許可された職員だけがFunction経由で操作する。申請の版とハッシュを照合し、初回承認の500コインとクリアを一度だけ反映する。児童画面に職員の認証情報を入力しない。未連携児童・公開ユーザーの既存確認経路は維持する。

## 必要な配備

1. `support_learning_bridge.sql`、既存 `word_teacher_approval.sql`、`support_word_reviews.sql`、`support_word_retention.sql` をこの順で適用する。
2. `student-word-review`、`support-word-review`、`word-review-cleanup` と更新した `admin-delete-auth-user` を配備する。
3. Dサポート側の `lesson-learning`、学習管理画面、権限追加を配備する。
4. 両サーバーの橋渡しSecrets、校舎/児童の許可、本人確認済み連携IDを設定する。秘密値を `VITE_*` に入れない。
5. Dサポートの専用運用スクリプト `configure-word-retention.mjs --apply` はリンク先プロジェクトを照合し、日次削除とVault/Secretsを設定する。汎用配備スクリプトではない。

一括本人照合は利用者が指定したExcelと事業所/校舎の許可に限定する。通常メールと教室ログインの複数Authが一人に関連する場合も、使用する本人Authで自己データだけを取得できることを確認し、既存のログインや取り組み記録を上書きしない。

## 期限と操作

送信準備は2時間、確認待ちは30日で期限終了。承認・差し戻し後の作品は90日、期限終了した送信済み作品は提出後90日で日次削除する。毎日03:20 JST、1回500件上限のため、削除に定期実行分の遅れがある。承認・監査の証跡は作品ファイルとは別に保持する。

児童データ削除時に共有停止・申請終了・作品/申請削除を行う。Authのみ削除する操作は学習データを残し、共有を止める。

児童画面ではWord表示中30秒ごと、Dサポートの通知はアプリ表示中60秒ごとに更新する。アプリを閉じている場合のWeb Pushやメール通知は未実装。承認が届いた後の古いデータ保存は `PT409` で拒否し、再読み込みを案内する。

## 検証

```powershell
npm.cmd exec --yes --package=@electric-sql/pglite -- node scripts/check-word-review-database.mjs
deno test supabase/functions/_shared/word-review_test.ts supabase/functions/_shared/word-retention_test.ts
deno check supabase/functions/student-word-review/index.ts supabase/functions/support-word-review/index.ts supabase/functions/word-review-cleanup/index.ts
npm.cmd run check:release
```

架空児童の実接続で申請から差し戻し・再申請・承認・データ反映まで確認した。画面試験はモックでデスクトップ/390px幅と再送を確認した。実児童の作品を試験用に提出・承認する操作は行わない。
