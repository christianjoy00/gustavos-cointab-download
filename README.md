# Gustavo's CoinTab V46 — GitHub Pages Dashboard

This is the static frontend for GitHub Pages. It connects directly to `https://api.rentaride.top/api/v1`; GitHub Pages cannot execute PHP, so it must not use `api-proxy.php`.

## Publish
1. Create/select the repository intended for the dashboard.
2. Copy the contents of this folder to the repository root (or configure Pages to use this folder).
3. Enable GitHub Pages for the chosen branch/folder.
4. Configure the API server's CORS allowlist to include the exact published GitHub Pages origin. Do not use wildcard CORS with credentials.
5. Test login, summary, licenses, commands, and tablet updates.

## Security
No API secrets belong in GitHub. Use the existing API login/session mechanism. If the API CORS policy cannot safely allow the GitHub Pages origin, host the dashboard on cPanel and use its same-origin PHP proxy instead.

## Known verification limits
The 50-game action and Application Policies are queued through existing command/configuration endpoints. They require matching server-side and Android command-handler support; a successful HTTP response alone does not prove installation or enforcement.
