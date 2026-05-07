# Dレッスン v4

小学生向けのPC練習アプリです。マウス練習、キーボード練習、ことば入力、ビジョントレーニング、ガチャ、管理者画面を含みます。

公開URL:

```text
https://dreams21st-wakamatsu-takasunishi.github.io/d-lesson-v4/
```

## ローカル起動

```powershell
cd "C:\Users\conta\Desktop\pcれんしゅう開発\Dレッスン5.0\d-lesson-v4"
npm.cmd install
npm.cmd run dev:local
```

ブラウザで次を開きます。

```text
http://127.0.0.1:5174/
```

## よく使う確認コマンド

ローカルのテスト環境で、ビルドと基本チェックをまとめて確認します。

```powershell
npm.cmd run check:release-test
```

公開URLが本番用 `user_data` を見ていて、手元の最新コミットまで反映済みか確認します。

```powershell
npm.cmd run check:public-latest
```

本番用 `.env.local` に切り替えた状態で公開前チェックを行う場合は、次を使います。

```powershell
npm.cmd run check:release
```

## GitHub Pages

`main` に push すると GitHub Actions が自動でビルドし、GitHub Pages に公開します。

Actions 側では次を確認します。

- 公開用環境変数が安全な値か
- インライン `onclick` などの参照先が存在するか
- ビルドが通るか
- デプロイ後の公開URLが `user_data` を見ているか
- 公開URLのビルド元コミットが push したコミットと一致するか

## Supabase

公開URLでは Supabase Auth と RLS を使います。公開環境では旧管理者パスワードを使いません。

GitHub Actions の Variables / Secrets には最低限次を設定します。

```text
VITE_SUPABASE_URL
VITE_SUPABASE_TABLE=user_data
VITE_SUPABASE_USE_TEST_TABLE=false
VITE_ENABLE_RLS_CLOUD_SYNC=true
VITE_ENABLE_SETTINGS_TABLE=true または false
VITE_SUPABASE_PUBLISHABLE_KEY
```

公開環境に設定しないもの:

```text
VITE_LEGACY_ADMIN_PASS
VITE_ENABLE_LEGACY_SUPABASE_SYNC=true
VITE_ALLOW_LEGACY_ADMIN_PASS=true
```

## 関連ドキュメント

- `docs/production-release-runbook.md`: 本番公開前の確認手順
- `docs/public-release-checklist.md`: 公開前チェックリスト
- `docs/supabase-rls-setup.md`: Supabase Auth / RLS 設定
- `docs/teacher-scope-setup.md`: 先生の担当範囲設定
- `docs/runtime-undefined-checklist.md`: 画面操作時の未定義エラー確認
- `docs/device-handoff-guide.md`: 端末切替と運用引き継ぎ
