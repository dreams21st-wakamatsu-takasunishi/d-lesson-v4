# GitHub Pages 公開手順

## 目的

GitHub に push した `main` ブランチを自動ビルドし、GitHub Pages の公開URLへ配信する。

想定URL:

```text
https://dreams21st-wakamatsu-takasunishi.github.io/d-lesson-v4/
```

## 初回設定

GitHub のリポジトリ画面で次を設定する。

1. `Settings` を開く。
2. `Pages` を開く。
3. `Build and deployment` の `Source` を `GitHub Actions` にする。
4. `Settings` > `Secrets and variables` > `Actions` を開く。
5. `Variables` に次を登録する。

```text
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_TABLE=test_user_data
VITE_SUPABASE_USE_TEST_TABLE=true
VITE_ENABLE_RLS_CLOUD_SYNC=true
VITE_ENABLE_SETTINGS_TABLE=false
```

6. `Secrets` に次を登録する。

```text
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
```

本番の児童データへ切り替えるときは、公開前に必ず次へ変更する。

```text
VITE_SUPABASE_TABLE=user_data
VITE_SUPABASE_USE_TEST_TABLE=false
```

現在の GitHub Actions は本番公開用の厳格チェックを使う。上の2つが本番値になっていない場合、`Deploy GitHub Pages` は失敗する。

## 公開URLの確認場所

公開後のURLは次のどちらかで確認できる。

- GitHub リポジトリの `Settings` > `Pages`
- GitHub リポジトリの `Actions` > `Deploy GitHub Pages` の実行結果

公開URLと配信ファイルが読めるかは、次でも確認できる。

```powershell
npm.cmd run check:public-url
```

本番切替後は、公開URLが `user_data` を向いていることも確認する。

```powershell
npm.cmd run check:public-production-url
```

pushした最新コミットがGitHub Pagesに反映済みかまで確認する場合:

```powershell
npm.cmd run check:public-latest
```

## 公開前チェック

テストテーブルで公開検証する場合:

```powershell
npm.cmd run check:release-test
```

本番テーブルで公開する場合:

```powershell
npm.cmd run check:release
```

## 注意

- `VITE_LEGACY_ADMIN_PASS` は公開URLには設定しない。
- `VITE_ENABLE_LEGACY_SUPABASE_SYNC` は公開URLでは `false` のままにする。
- `VITE_REQUIRE_SUPABASE_AUTH` と `VITE_ALLOW_LEGACY_ADMIN_PASS` は workflow 側で安全な値に固定している。
- GitHub Pages は `/d-lesson-v4/` 配下で配信されるため、Vite の `base` は `./` にしている。
