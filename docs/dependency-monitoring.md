# Dレッスンのセキュリティ警告の確認

- **GitHubのDependabot** はリポジトリの既知の脆弱性を検知します。対象になる修正版がある場合は修正の提案が届きます。自動で適用・公開はしません。
- **Dependency security monitoring** は、更新がない日も毎日8:23頃（日本時間）に `package-lock.json` を検査します。本番用と開発用の両方を対象とし、低・中を含む警告が1件でもあれば Actions に要確認として残します。個別の警告は権限のある人が Dependabot 画面で確認します。監視ジョブでは依存パッケージのインストールや本番アプリ・データへのアクセスは行いません。
- **公開前の検査** は重大度 High / Critical がある場合は公開を停止します。監視・公開前のどちらも npm の検査に失敗した場合は3回まで試し、確認不能を「異常なし」とは扱いません。監視が失敗しても公開済みのアプリは止まりません。

## 通知を受け取り、確認する

1. [Dレッスンのリポジトリ](https://github.com/dreams21st-wakamatsu-takasunishi/d-lesson-v4) で、管理者本人が **Watch → Custom → Security alerts** を選びます。
2. [GitHubの通知設定](https://github.com/settings/notifications) で Dependabot alerts の通知先を選びます。中・低も含めて見落とさないために、定期ダイジェストも確認します。定期実行の通知先は、GitHub Actions の通知設定とスケジュールを最後に更新したアカウントに依存します。
3. [Dependabotの警告一覧](https://github.com/dreams21st-wakamatsu-takasunishi/d-lesson-v4/security/dependabot) で具体的な対象と修正版を確認します。[定期チェックの実行履歴](https://github.com/dreams21st-wakamatsu-takasunishi/d-lesson-v4/actions/workflows/dependency-monitor.yml) でスケジュールの最終実行を確認し、通信失敗は **Run workflow** から再確認します。

GitHubの混雑時は定期チェックが遅延・省略されることがあります。また、公開リポジトリに60日間活動がないと定期チェックが停止するため、停止時は Actions で有効化し直します。Dependabot は別の検知経路です。この仕組みは登録済みの脆弱性が対象で、未知の問題や侵入の有無を検査するものではありません。

参考: [GitHubのセキュリティ通知](https://docs.github.com/en/subscriptions-and-notifications/how-tos/managing-security-notifications)、[GitHub Actionsの定期実行](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
