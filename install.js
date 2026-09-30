/* Colorquest — installation is a browser action, never a simulated success. */
(function () {
  'use strict';
  const baseURL = new URL('./', document.currentScript?.src || location.href);
  const standalone = matchMedia('(display-mode: standalone)');
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const canRegister = ['https:', 'http:'].includes(location.protocol) &&
    window.isSecureContext && 'serviceWorker' in navigator;
  let promptEvent = null, registration = null, offlineReady = false;
  let installed = standalone.matches || navigator.standalone === true;
  let installPending = false, reloadingForUpdate = false, reloaded = false;
  let restorePause = false, returnFocus = null;
  let statusText = canRegister ? 'Préparation du mode hors ligne…' : 'Ajoutez Colorquest à votre écran d’accueil.';

  const card = document.createElement('div');
  card.className = 'install-card';
  card.innerHTML = '<button id="installGame" class="install-button" type="button"><span class="install-icon" aria-hidden="true">↧</span><span><strong>Installer sur mon téléphone</strong><small>Une icône sur votre écran d’accueil</small></span><span aria-hidden="true">↗</span></button><p id="offlineStatus" class="offline-status" role="status" aria-live="polite"></p><button id="updateGame" class="update-button" type="button" hidden>↻ Nouvelle version disponible</button>';
  document.querySelector('.start-card')?.insertAdjacentElement('afterend', card);
  document.getElementById('menu')?.classList.add('has-install');
  const installButton = card.querySelector('#installGame');
  const status = card.querySelector('#offlineStatus');
  const updateButton = card.querySelector('#updateGame');

  const dialog = document.createElement('dialog');
  dialog.id = 'installDialog';
  dialog.className = 'install-dialog';
  dialog.setAttribute('aria-labelledby', 'installTitle');
  document.body.append(dialog);

  function activeMatch() {
    return typeof playing !== 'undefined' && playing && (typeof ended === 'undefined' || !ended);
  }

  function renderStatus() {
    installButton.hidden = installed;
    status.textContent = (installed ? 'Application installée · ' : '') + statusText;
    status.classList.toggle('is-ready', offlineReady);
    const details = dialog.querySelector('#installOfflineStatus');
    if (details) details.textContent = statusText;
  }

  function closeDialog() { dialog.close(); }

  function showDialog(contents) {
    if (!dialog.open) {
      returnFocus = document.activeElement;
      restorePause = activeMatch() && typeof paused !== 'undefined' && !paused;
      if (restorePause && typeof togglePause === 'function') togglePause();
    }
    dialog.innerHTML = '<button type="button" class="install-close" aria-label="Fermer">×</button>' + contents;
    dialog.querySelector('.install-close').onclick = closeDialog;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('.install-close').focus();
  }

  dialog.addEventListener('close', () => {
    if (restorePause && !reloadingForUpdate && activeMatch() && typeof paused !== 'undefined' && paused && typeof togglePause === 'function') togglePause();
    restorePause = false;
    returnFocus?.focus?.();
  });
  // Global game shortcuts must not operate behind the install/update dialog.
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });

  function showInstallHelp() {
    let steps;
    if (location.protocol === 'file:') {
      steps = '<p>Pour installer le jeu, ouvrez sa version en ligne sur votre téléphone. Le fichier HTML local reste jouable, mais ne peut pas installer le mode application.</p><p><a href="https://madec01.github.io/colorquest/" target="_blank" rel="noopener">Ouvrir Colorquest en ligne ↗</a></p>';
    } else if (!window.isSecureContext) {
      steps = '<p>Ouvrez la version sécurisée du jeu pour l’installer sur votre téléphone.</p><p><a href="https://madec01.github.io/colorquest/" target="_blank" rel="noopener">Ouvrir Colorquest en ligne ↗</a></p>';
    } else if (isIOS) {
      steps = '<ol><li>Ouvrez cette page dans <b>Safari</b>.</li><li>Touchez <b>Partager</b> (le carré avec une flèche vers le haut). Selon votre barre d’outils, ouvrez d’abord le menu de la page.</li><li>Choisissez <b>Sur l’écran d’accueil</b> ou <b>Ajouter à l’écran d’accueil</b>.</li><li>Si l’option est proposée, activez <b>Ouvrir comme app web</b>, puis touchez <b>Ajouter</b>.</li></ol><p>Vous ne voyez pas l’action ? Descendez dans le menu Partager et touchez <b>Modifier les actions</b>.</p>';
    } else {
      steps = '<ol><li>Ouvrez le <b>menu du navigateur ⋮</b>.</li><li>Choisissez <b>Installer l’application</b> ou <b>Ajouter à l’écran d’accueil</b>, si cette option est disponible.</li><li>Confirmez, puis lancez Colorquest depuis sa nouvelle icône.</li></ol><p>Sur ordinateur, utilisez aussi l’icône d’installation près de la barre d’adresse. Si votre navigateur ne propose pas l’installation, le jeu reste accessible ici.</p>';
    }
    const pending = installPending ? '<p>La demande a été acceptée. Terminez les étapes proposées par votre navigateur.</p>' : '';
    showDialog('<div class="eyebrow">VOTRE TOILE, À PORTÉE DE MAIN</div><h2 id="installTitle">Colorquest sur votre téléphone.</h2>' + pending + steps + '<p>Après installation, ouvrez l’app une fois avec une connexion et attendez « Prêt à jouer hors ligne ».</p><p id="installOfflineStatus" class="install-offline-note"></p><p class="install-progress-note">Le mode hors ligne conserve les fichiers du jeu. La partie se sauvegarde automatiquement sur cet appareil ; retrouvez-la avec « Reprendre la partie ». Le tutoriel se recommence depuis le début.</p><button id="installHelpDone" type="button" class="primary">Compris</button>');
    dialog.querySelector('#installHelpDone').onclick = closeDialog;
    renderStatus();
  }

  async function install() {
    if (installed) return;
    if (!promptEvent) { showInstallHelp(); return; }
    const event = promptEvent;
    promptEvent = null;
    installButton.disabled = true;
    try {
      // Must remain in the user gesture: do not await anything before prompt().
      const result = await event.prompt();
      const choice = result || await event.userChoice;
      installPending = choice?.outcome === 'accepted';
      if (installPending && !installed) showInstallHelp();
    } catch {
      showInstallHelp();
    } finally {
      installButton.disabled = false;
    }
  }

  async function checkOfflineReady(worker) {
    if (!worker) return;
    try {
      const result = await new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        const timer = setTimeout(() => { channel.port1.close(); reject(new Error('offline-status-timeout')); }, 5000);
        channel.port1.onmessage = event => {
          clearTimeout(timer); channel.port1.close(); resolve(event.data);
        };
        worker.postMessage({ type: 'CHECK_OFFLINE_READY' }, [channel.port2]);
      });
      offlineReady = result?.type === 'OFFLINE_STATUS' && result.ready === true;
      statusText = offlineReady ? 'Prêt à jouer hors ligne sur cet appareil.' : 'Mode hors ligne incomplet. Rouvrez le jeu avec une connexion.';
    } catch {
      offlineReady = false;
      statusText = 'Mode hors ligne non confirmé. Gardez une connexion pour le prochain lancement.';
    }
    renderStatus();
  }

  function offerUpdate() {
    updateButton.hidden = !(registration?.waiting && navigator.serviceWorker.controller);
    if (updateButton.hidden) return;
    if (activeMatch() && typeof toast === 'function') toast('Une mise à jour est prête. Elle vous attend au menu après la partie.');
  }

  function showUpdate() {
    if (!registration?.waiting) return;
    showDialog('<div class="eyebrow">NOUVELLE COULEUR, MÊME TOILE</div><h2 id="installTitle">Une mise à jour est prête.</h2><p>Recharger ouvre la nouvelle version. Votre partie sera sauvegardée avant le rechargement ; reprenez-la ensuite depuis le menu. Un tutoriel en cours se recommencera depuis le début.</p><button id="confirmGameUpdate" type="button" class="primary">Mettre à jour et recharger</button><button id="cancelGameUpdate" type="button" class="install-secondary">Plus tard</button>');
    dialog.querySelector('#cancelGameUpdate').onclick = closeDialog;
    dialog.querySelector('#confirmGameUpdate').onclick = () => {
      if (!registration.waiting) { closeDialog(); updateButton.hidden = true; return; }
      if (activeMatch() && !window.CQTutorial?.active) {
        const saved = window.CQSave?.save();
        if (saved && !saved.ok && !saved.skipped) {
          dialog.querySelector('p').textContent = saved.message + ' La mise à jour attendra votre retour au menu.';
          return;
        }
      }
      reloadingForUpdate = true;
      dialog.querySelector('#confirmGameUpdate').disabled = true;
      dialog.querySelector('#confirmGameUpdate').textContent = 'Mise à jour…';
      registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
    };
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    promptEvent = event; installPending = false;
    renderStatus();
  });
  window.addEventListener('appinstalled', () => {
    installed = true; installPending = false; promptEvent = null;
    if (dialog.open && dialog.querySelector('#installHelpDone')) closeDialog();
    renderStatus();
  });
  standalone.addEventListener?.('change', event => {
    installed = event.matches || navigator.standalone === true;
    renderStatus();
  });
  installButton.onclick = install;
  updateButton.onclick = showUpdate;
  renderStatus();

  if (canRegister) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadingForUpdate && !reloaded) {
        reloaded = true; location.reload(); return;
      }
      offerUpdate();
      checkOfflineReady(navigator.serviceWorker.controller);
    });
    navigator.serviceWorker.register(new URL('sw.js', baseURL), {
      scope: baseURL.href, updateViaCache: 'none'
    }).then(reg => {
      registration = reg;
      offerUpdate();
      const observeWorker = worker => {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed') offerUpdate();
          if (worker.state === 'redundant' && !registration.active) {
            statusText = 'Mode hors ligne indisponible. Réessayez avec une connexion.';
            renderStatus();
          }
        });
      };
      observeWorker(reg.installing);
      reg.addEventListener('updatefound', () => observeWorker(reg.installing));
      navigator.serviceWorker.ready.then(ready => checkOfflineReady(ready.active));
      // With cache-first navigation, this check discovers the next full release.
      if (!reg.installing) reg.update().catch(() => {});
    }).catch(() => {
      statusText = 'Mode hors ligne indisponible dans ce navigateur. Le jeu reste jouable en ligne.';
      renderStatus();
    });
  }

  window.CQInstall = {
    showHelp: showInstallHelp,
    showUpdate,
    get offlineReady() { return offlineReady; },
    get installed() { return installed; }
  };
}());
