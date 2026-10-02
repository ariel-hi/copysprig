// Returns an honest outcome; callers open manual selection when both routes fail.
export async function copyText(text, environment = {}) {
  const clipboard = environment.clipboard ?? globalThis.navigator?.clipboard;
  const doc = environment.document ?? globalThis.document;
  try { if (clipboard?.writeText) { await clipboard.writeText(String(text)); return 'clipboard'; } } catch { /* Try legacy selection. */ }
  if (!doc?.createElement) return 'manual';
  const previous = doc.activeElement;
  const field = doc.createElement('textarea');
  field.value = String(text);
  field.setAttribute('readonly','');
  field.style.cssText = 'position:fixed;left:-9999px;top:0;';
  doc.body.appendChild(field);
  let succeeded = false;
  try { field.select(); succeeded = doc.execCommand?.('copy') === true; } catch { /* Manual selection remains available. */ }
  finally { field.remove(); previous?.focus?.({preventScroll:true}); }
  return succeeded ? 'selection' : 'manual';
}
