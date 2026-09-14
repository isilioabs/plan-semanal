// Keyboard and focus management for the existing generated UI.
(function () {
  let active = null, returnFocus = null;
  const focusTargets = new WeakMap();
  const focusable = node => [...node.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')]
    .filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
  function sync() {
    // The bundler briefly inserts the unrendered x-dc template. Do not alter it.
    if (document.querySelector('x-dc')) return;
    const dialogs = [...document.querySelectorAll('[data-planner-dialog]')].filter(el => el.getClientRects().length);
    const dialog = dialogs[dialogs.length - 1] || null;
    const saving = !!document.querySelector('[data-planner-saving]');
    for (const el of document.querySelectorAll('[data-planner-background]')) el.inert = !!dialog || saving;
    for (const el of dialogs) el.inert = el !== dialog || saving;
    if (dialog === active) return;
    if (dialog) {
      if (!focusTargets.has(dialog)) focusTargets.set(dialog,document.activeElement);
      returnFocus = focusTargets.get(dialog);
      active = dialog;
      document.body.style.overflow = 'hidden';
      (dialog.querySelector('[data-close-dialog]') || dialog).focus();
    } else {
      active = null;
      document.body.style.overflow = '';
      if (returnFocus && returnFocus.isConnected) returnFocus.focus();
      returnFocus = null;
    }
  }
  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, {childList:true,subtree:true});
  document.addEventListener('keydown', e => {
    if (!active) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      const button = active.querySelector('[data-close-dialog]');
      if (button) button.click();
    }
    if (e.key === 'Tab') {
      const items = focusable(active);
      if (!items.length) { e.preventDefault(); active.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !active.contains(document.activeElement))) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !active.contains(document.activeElement))) {
        e.preventDefault(); first.focus();
      }
    }
  });
  sync();
})();
