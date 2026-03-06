/**
 * @module client/gpio/pin-table
 * @description Pin state table rendering module.
 * Displays all GPIO pins with their port, pin number, direction, and state.
 */

import type { PinState } from "./gpio-state";

let tableBody: HTMLTableSectionElement;

/**
 * Initialize the pin table inside the given container element.
 * Creates an HTML table with headers: Port, Pin, Direction, State.
 */
export function initPinTable(container: HTMLElement): void {
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.innerHTML = `<tr><th>Port</th><th>Pin</th><th>Direction</th><th>State</th></tr>`;
  tableBody = document.createElement("tbody");
  table.appendChild(thead);
  table.appendChild(tableBody);
  container.appendChild(table);
}

/**
 * Replace the table body with rows from the given pin array.
 * State shows "HIGH" (green) or "LOW" (dim).
 * Direction shows "IN" (orange) or "OUT" (blue).
 */
export function updatePinTable(pins: PinState[]): void {
  tableBody.innerHTML = "";
  for (const p of pins) {
    const row = document.createElement("tr");

    const portCell = document.createElement("td");
    portCell.textContent = p.port;

    const pinCell = document.createElement("td");
    pinCell.textContent = String(p.pin);

    const dirCell = document.createElement("td");
    dirCell.textContent = p.direction === "input" ? "IN" : "OUT";
    dirCell.className = p.direction === "input" ? "dir-in" : "dir-out";

    const stateCell = document.createElement("td");
    stateCell.textContent = p.value ? "HIGH" : "LOW";
    stateCell.className = p.value ? "pin-high" : "pin-low";

    row.appendChild(portCell);
    row.appendChild(pinCell);
    row.appendChild(dirCell);
    row.appendChild(stateCell);
    tableBody.appendChild(row);
  }
}

/**
 * Empty the table body.
 */
export function clearPinTable(): void {
  if (tableBody) {
    tableBody.innerHTML = "";
  }
}
