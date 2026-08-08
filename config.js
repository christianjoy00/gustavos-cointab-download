/* Gustavo's Cointab dashboard deployment configuration.
 * - On rentaride.top/cPanel, requests use the bundled same-origin PHP proxy.
 * - On GitHub Pages, requests go directly to the public API and require the
 *   GitHub origin to be allowed by the API server's CORS configuration.
 */
(() => {
  const host = String(location.hostname || '').toLowerCase();
  const isGitHubPages = host.endsWith('.github.io');

  window.CointabApiConfig = {
    baseUrl: 'https://api.rentaride.top/api/v1',
    proxyUrl: isGitHubPages ? '' : new URL('api-proxy.php', location.href).href,
    requestTimeoutMs: 25000,
    latestLauncherVersion: 'V6.0.8'
  };
})();
