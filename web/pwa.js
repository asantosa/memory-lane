(() => {
  const dialog = document.getElementById('install-dialog');
  const open = document.getElementById('install-help');
  const install = document.getElementById('install-app');
  const status = document.getElementById('app-availability');
  let prompt;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) open.textContent = 'App & offline access';
  open.addEventListener('click', () => dialog.showModal());
  document.getElementById('close-install').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r=dialog.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) dialog.close(); } });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); prompt = event; install.hidden = false; });
  install.addEventListener('click', async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    prompt = null;
    install.hidden = true;
  });
  window.addEventListener('appinstalled', () => { install.hidden = true; open.textContent = 'App & offline access'; });
  const connection = () => { document.getElementById('connection-status').hidden = navigator.onLine; };
  window.addEventListener('online', connection);
  window.addEventListener('offline', connection);
  connection();
  if (!/^https?:$/.test(location.protocol)) { status.textContent = 'Open the hosted HTTPS version to install Memory Lane and enable offline access.'; return; }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(() => {
      status.textContent = 'Ready for offline use on this device. Your saved memories and drafts are available in this browser.';
    }).catch(() => { status.textContent = 'Offline setup is unavailable right now. You can keep using Memory Lane while connected.'; });
  } else status.textContent = 'Use a supported browser over HTTPS for offline access.';
})();
