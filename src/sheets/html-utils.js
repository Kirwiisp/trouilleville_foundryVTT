/** Escapes a string for safe interpolation into an HTML template literal (dialog/chat content
 *  built by hand in this project's sheets — actor/item names could in principle come from
 *  untrusted compendium content, so this is never skipped). */
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[c]);
}
