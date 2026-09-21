# newanki Android

`newanki` のWebアプリをTrusted Web Activityで開くAndroidラッパーです。

- Application ID: `jp.sushisyonen.newanki`
- Version: `1.0.0` (`versionCode 1`)
- Minimum Android: 8.0（API 26）
- Target / Compile SDK: 36
- Web origin: `https://newanki-study-sushi.sushisyo-nen.chatgpt.site`

## Release build

署名鍵はリポジトリ外の `../.signing/newanki-release.jks` にあり、Gitには含めません。鍵とパスワードを失うと、同じアプリを上書き更新できなくなります。

Bubblewrap 1.25.0 または生成済みのGradle Wrapperを使い、リリースビルドを作成します。完成した配布物は `outputs/newanki-1.0.0.apk` に配置します。

Digital Asset LinksはWeb側の `/.well-known/assetlinks.json` で公開します。署名鍵を変更した場合は、APKとこのファイルを同時に更新してください。
