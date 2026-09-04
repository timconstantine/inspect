// Loaded by the GKD Android app's local debug HTTP server (see
// HttpService.kt / Constants.SERVER_SCRIPT_URL) when a browser opens the
// device's local inspection URL. It forwards the browser to the hosted
// snapshot inspector UI, passing along the local server's own origin so
// the UI can connect back to the device automatically.
(function () {
  var deviceOrigin = window.location.origin;
  var target =
    'https://timconstantine.github.io/inspect/device?url=' +
    encodeURIComponent(deviceOrigin);
  window.location.replace(target);
})();
