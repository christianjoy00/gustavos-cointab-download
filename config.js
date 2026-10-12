/* CoinTab cPanel dashboard configuration. */
(() => {
  window.CointabApiConfig = {
    baseUrl: 'https://cointab.gustavoselectronics.com/api/v1',
    proxyUrl: new URL('api-proxy.php', location.href).href,
    requestTimeoutMs: 25000,
    latestLauncherVersion: 'V6.0.44'
  };
})();
