# GitHub dashboard migration

Add `config.js` (copied from `config.example.js`) and `api-client.js` to the GitHub Pages dashboard. Replace Apps Script calls with `CoinTabApi.login`, `CoinTabApi.summary`, `CoinTabApi.licenses`, and `CoinTabApi.command`. The dashboard receives only a short-lived account token; it never receives database, SMTP, signing, or Xendit secrets.
