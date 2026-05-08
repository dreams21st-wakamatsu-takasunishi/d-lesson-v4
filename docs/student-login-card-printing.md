# 児童ログインカード印刷手順

## 目的

児童がDレッスンへ入るための `児童番号` と `あいことば` を、配布しやすいカード形式で印刷します。

カードにはあいことばが含まれるため、出力ファイルと印刷物は名簿と同じ扱いで管理します。

## 1. CSVを用意する

先に `migration/student-login-accounts.csv` を作成し、Supabase Auth の `auth_user_id` まで入力しておきます。

CSV確認:

```powershell
npm.cmd run check:student-login-csv -- --mapping ".\migration\legacy-user-map.csv" --input ".\migration\student-login-accounts.csv" --domain "dlesson.example.com" --require-auth-user-id
```

`dlesson.example.com` は実際に使っている児童ログイン用ドメインに置き換えます。

## 2. 印刷用HTMLを作る

```powershell
npm.cmd run build:student-login-cards -- --input ".\migration\student-login-accounts.csv" --output ".\migration\student-login-cards.html"
```

公開URLもカードに印刷する場合:

```powershell
npm.cmd run build:student-login-cards -- --input ".\migration\student-login-accounts.csv" --output ".\migration\student-login-cards.html" --url "https://dreams21st-wakamatsu-takasunishi.github.io/d-lesson-v4/"
```

名前をカードに印刷したくない場合:

```powershell
npm.cmd run build:student-login-cards -- --input ".\migration\student-login-accounts.csv" --output ".\migration\student-login-cards.html" --hide-name
```

## 3. 印刷する

1. `migration/student-login-cards.html` をブラウザで開く。
2. 画面上の `印刷` ボタン、または `Ctrl + P` を押す。
3. 用紙を `A4`、倍率を `既定` または `100%` にする。
4. 余白が大きく崩れる場合は、ブラウザの印刷設定で `背景のグラフィック` をオンにする。

## 4. 配布時の注意

- 児童番号とあいことばは、本人だけに配る。
- 予備カードは鍵のかかる場所で保管する。
- 紛失した場合は、その児童の Supabase Auth パスワードを変更し、カードを再発行する。
- 使わなくなったカードはそのまま捨てず、細かく破棄する。

## 5. Gitに入れないもの

次のファイルは児童情報・あいことばを含むため、Gitに入れません。

- `migration/student-login-accounts.csv`
- `migration/student-login-cards.html`

`migration/` は `.gitignore` で除外済みです。
