/**
 * @module client/controls/error-panel
 * @description Compilation error display panel.
 * Shows formatted error messages from the compile API response.
 */

let panel: HTMLElement;

/**
 * Initialize the error panel (store reference to the DOM element).
 */
export function initErrorPanel(el: HTMLElement): void {
  panel = el;
}

/**
 * Display compilation errors in the error panel.
 * Each error is shown on its own line with optional line:column prefix.
 */
export function showErrors(
  errors: Array<{ message: string; line?: number; column?: number }>
): void {
  if (!panel) return;
  panel.innerHTML = "";
  for (const err of errors) {
    const div = document.createElement("div");
    let prefix = "";
    if (err.line != null) {
      prefix = err.column != null ? `${err.line}:${err.column}: ` : `${err.line}: `;
    }
    div.textContent = `${prefix}${err.message}`;
    panel.appendChild(div);
  }
  panel.classList.add("visible");
}

/**
 * Clear all errors and hide the panel.
 */
export function clearErrors(): void {
  if (!panel) return;
  panel.innerHTML = "";
  panel.classList.remove("visible");
}
