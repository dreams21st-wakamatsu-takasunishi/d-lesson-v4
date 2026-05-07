# クリック操作のみの児童ログイン

## 目的

キーボード入力が難しい児童でも、URLアイコンからDレッスンを開き、画面上のボタン操作だけで練習を始められるようにします。

情報漏洩を避けるため、ログイン前には児童名一覧を表示しません。児童は「児童番号」と画面テンキーの「あいことば」でログインします。

## 仕組み

児童ごとに Supabase Auth アカウントを作成します。ただし、画面にはメールアドレスやAuth User IDを出しません。

例:

```text
画面で選ぶ番号: 1
内部メール: dlesson-student-001@example.com
あいことば: 6けた以上の数字
```

ログイン後、`lesson_user_access` とRLSにより、その児童本人の `user_data` だけを読み込みます。本人データが1件だけ見える場合は、名前選択画面を通らず自動で練習メニューに進みます。

## 環境変数

クリックログインを有効にするには、`.env.local` または GitHub Actions の Secrets/Variables に次を設定します。

```env
VITE_STUDENT_LOGIN_EMAIL_DOMAIN=example.com
VITE_STUDENT_LOGIN_EMAIL_PREFIX=dlesson-student-
VITE_STUDENT_LOGIN_NUMBER_PAD=3
VITE_STUDENT_LOGIN_MIN=1
VITE_STUDENT_LOGIN_MAX=40
VITE_STUDENT_LOGIN_PASSCODE_MIN_LENGTH=6
VITE_STUDENT_LOGIN_PASSCODE_MAX_LENGTH=12
```

`VITE_STUDENT_LOGIN_EMAIL_DOMAIN` が空の場合は、従来どおりメールアドレスとパスワードのログイン画面になります。

## 運用ルール

- 児童番号は名簿番号など、児童自身が選びやすい番号にします。
- あいことばは誕生日や連番を避け、児童ごとに異なる6けた以上の数字にします。
- 児童にはメールアドレスやAuth User IDを配布しません。
- 教師・管理者ログインは、同じログイン画面の「先生・管理者ログイン」から行います。

## 確認項目

- ログイン前に児童名一覧が表示されない。
- 児童は番号ボタンと画面テンキーだけでログインできる。
- 児童ログイン後、自分の練習メニューに自動で進む。
- 児童ログインで他児童の名前や進捗が見えない。
- 先生・管理者は従来のメールアドレス/パスワードでログインできる。
