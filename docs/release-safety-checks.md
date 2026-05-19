# Dレッスン 公開前チェック一覧

この資料は、公開前に実行するチェックが「何を守っているか」を確認するためのものです。

## 基本コマンド

通常の公開前確認は次を実行します。

```powershell
npm.cmd run check:release
```

テスト用テーブル `test_user_data` を使う検証段階では次を使います。

```powershell
npm.cmd run check:release-test
```

## check:release に含まれる主な確認

| チェック | 守っていること |
| --- | --- |
| `check:public-env` | 本番公開時に `user_data` を使う設定になっていること |
| `check:legacy-password` | 旧式の管理者パスワード導線が戻っていないこと |
| `check:admin-auth-utils` | 管理者・先生の認可補助処理が壊れていないこと |
| `check:admin-report-utils` | レポート出力用の整形処理が壊れていないこと |
| `check:admin-practice-history-utils` | 取り組み記録の集計・出力処理が壊れていないこと |
| `check:admin-dashboard-utils` | 管理者ダッシュボードの集計補助処理が壊れていないこと |
| `check:admin-progress-editor-utils` | 進捗編集・リセット処理が壊れていないこと |
| `check:clear-guards` | クリア処理の二重実行防止が残っていること |
| `check:student-login-ui` | 児童ログインのあいことば表示切替が残っていること |
| `check:teacher-status-ui` | 先生用確認の検索、絞り込み、並び替え、要確認ラベル、印刷/CSVが残っていること |
| `check:practice-interrupts` | 練習を途中でやめた時の取り組み記録が残る導線が壊れていないこと |
| `check:typing-ranking` | タイピングランキングの最高記録保存、同一児童重複防止、ニックネーム安全対策が残っていること |
| `check:inline-handlers` | HTML の `onclick` などが未定義関数を呼んでいないこと |
| `check:undefined` | JavaScript 内の未定義参照を増やしていないこと |
| `build` | 本番ビルドが通ること |

## 個別に確認したいとき

クリア処理の二重実行防止だけを確認する場合:

```powershell
npm.cmd run check:clear-guards
```

児童ログインのあいことば表示切替だけを確認する場合:

```powershell
npm.cmd run check:student-login-ui
```

先生用確認の主要UIだけを確認する場合:

```powershell
npm.cmd run check:teacher-status-ui
```

練習中断時の取り組み記録だけを確認する場合:

```powershell
npm.cmd run check:practice-interrupts
```

タイピングランキングの安全対策だけを確認する場合:

```powershell
npm.cmd run check:typing-ranking
```

画面操作時の未定義関数を確認する場合:

```powershell
npm.cmd run check:inline-handlers
npm.cmd run check:undefined
```

## チェックが失敗したとき

1. 表示された `check:...` の名前を確認します。
2. この資料の表で、どの機能を守るチェックか確認します。
3. 該当する画面や機能を修正します。
4. もう一度 `npm.cmd run check:release` を実行します。

`check:release` が通っても、実操作の確認は別途必要です。特に、ログイン、練習開始、練習終了、保存、再読み込み後の保持、管理者画面の主要操作は手動確認してください。
