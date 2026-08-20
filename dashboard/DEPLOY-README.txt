GUSTAVO'S COINTAB DASHBOARD v6.0.3

CPANEL / RENTARIDE.TOP
1. Back up the current dashboard folder.
2. Upload every file in this ZIP to the document root for https://rentaride.top/
3. Include hidden file .htaccess and api-proxy.php.
4. Clear browser cache or open an InPrivate window.

GITHUB PAGES
Upload index.html, styles.css, app.js, api-client.js, config.js and config.example.js.
GitHub does not execute api-proxy.php. The dashboard therefore connects directly to https://api.rentaride.top/api/v1 and the API must allow the GitHub origin.

IMPORTANT SALES RESET FIX
The dashboard UI alone cannot clear the physical tablet. Install the accompanying SQL patch and replace the two PHP server files from the server patch ZIP. The PHP patch queues the exact legacy resetSales command, reports PENDING/APPLIED status, saves the sales totals sent by the old APK heartbeat, and uses Philippine day boundaries.


v6.0.4 changes:
- Launcher card now shows the actual installed version from heartbeat or settings.appVersion.
- Displays V6.0.0 style instead of UNKNOWN when the tablet has reported a version.
- Use the companion sales recovery SQL to restore Google Sheets sales.
