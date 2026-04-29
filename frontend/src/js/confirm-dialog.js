(function () {
  if (window.APP_CONFIRM_DANGER) {
    return;
  }

  const styles = `
    .confirm-overlay {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(15, 23, 42, 0.62);
      backdrop-filter: blur(8px);
      z-index: 2000;
    }

    .confirm-overlay.open {
      display: flex;
    }

    .confirm-dialog {
      width: min(100%, 460px);
      border-radius: 20px;
      background: #ffffff;
      border: 1px solid rgba(148, 163, 184, 0.28);
      box-shadow: 0 30px 80px rgba(15, 23, 42, 0.35);
      overflow: hidden;
      transform: translateY(4px) scale(0.98);
      animation: confirm-pop 0.18s ease-out forwards;
    }

    .confirm-header {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 22px 22px 0;
    }

    .confirm-icon {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: #fee2e2;
      color: #b91c1c;
    }

    .confirm-title {
      margin: 0;
      font-size: 1.02rem;
      font-weight: 800;
      color: #0f172a;
    }

    .confirm-message {
      margin: 6px 0 0;
      color: #475569;
      font-size: 0.9rem;
      line-height: 1.45;
    }

    .confirm-details {
      margin: 16px 22px 0;
      padding: 12px 14px;
      border-radius: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #334155;
      font-size: 0.86rem;
    }

    .confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 20px 22px 22px;
      flex-wrap: wrap;
    }

    .confirm-btn {
      min-width: 120px;
      border-radius: 12px;
      border: 1px solid transparent;
      padding: 10px 14px;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
    }

    .confirm-btn:active {
      transform: translateY(1px);
    }

    .confirm-btn.secondary {
      background: #fff;
      border-color: #cbd5e1;
      color: #334155;
    }

    .confirm-btn.primary {
      background: #b91c1c;
      color: #fff;
      box-shadow: 0 10px 20px rgba(185, 28, 28, 0.22);
    }

    .confirm-btn.primary:hover {
      background: #991b1b;
    }

    @keyframes confirm-pop {
      from {
        transform: translateY(10px) scale(0.96);
        opacity: 0;
      }
      to {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
    }
  `;

  const style = document.createElement('style');
  style.setAttribute('data-confirm-dialog', 'true');
  style.textContent = styles;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';
  overlay.setAttribute('role', 'presentation');
  overlay.innerHTML = `
    <div class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmDialogTitle">
      <div class="confirm-header">
        <div class="confirm-icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 8v4"></path>
            <path d="M12 16h.01"></path>
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path>
          </svg>
        </div>
        <div>
          <h3 id="confirmDialogTitle" class="confirm-title">Confirmar acción</h3>
          <p id="confirmDialogMessage" class="confirm-message">¿Deseas continuar?</p>
        </div>
      </div>
      <div id="confirmDialogDetails" class="confirm-details" style="display:none;"></div>
      <div class="confirm-actions">
        <button type="button" class="confirm-btn secondary" id="confirmDialogCancel">Cancelar</button>
        <button type="button" class="confirm-btn primary" id="confirmDialogConfirm">Eliminar</button>
      </div>
    </div>
  `;

  let resolver = null;
  const titleNode = overlay.querySelector('#confirmDialogTitle');
  const messageNode = overlay.querySelector('#confirmDialogMessage');
  const detailsNode = overlay.querySelector('#confirmDialogDetails');
  const cancelButton = overlay.querySelector('#confirmDialogCancel');
  const confirmButton = overlay.querySelector('#confirmDialogConfirm');

  function close(result) {
    overlay.classList.remove('open');
    resolver?.(result);
    resolver = null;
  }

  cancelButton.addEventListener('click', () => close(false));
  confirmButton.addEventListener('click', () => close(true));
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close(false);
    }
  });

  window.APP_CONFIRM_DANGER = function APP_CONFIRM_DANGER({
    title = 'Confirmar acción',
    message = '¿Deseas continuar?',
    details = '',
    confirmText = 'Eliminar',
  } = {}) {
    titleNode.textContent = title;
    messageNode.textContent = message;
    confirmButton.textContent = confirmText;

    if (details) {
      detailsNode.textContent = details;
      detailsNode.style.display = 'block';
    } else {
      detailsNode.textContent = '';
      detailsNode.style.display = 'none';
    }

    if (!overlay.isConnected) {
      document.body.appendChild(overlay);
    }

    overlay.classList.add('open');
    return new Promise((resolve) => {
      resolver = resolve;
    });
  };
})();
