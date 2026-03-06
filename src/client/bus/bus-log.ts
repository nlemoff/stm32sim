/**
 * @module client/bus/bus-log
 * @description SPI/I2C bus transaction log panel.
 * Displays timestamped rows for each SPI or I2C transfer event,
 * auto-scrolling to show the latest transaction.
 */

let logContainer: HTMLElement | null = null;

/**
 * Initialize the bus log panel with a table header inside the given container.
 * Creates a scrollable wrapper with a table containing Time, Bus, Dir, Size, Data columns.
 */
export function initBusLog(container: HTMLElement): void {
  logContainer = container;

  const scrollWrapper = document.createElement("div");
  scrollWrapper.className = "bus-log-scroll";

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr><th>Time</th><th>Bus</th><th>Dir</th><th>Size</th><th>Data</th></tr>
    </thead>
    <tbody id="bus-log-body"></tbody>
  `;

  scrollWrapper.appendChild(table);
  container.appendChild(scrollWrapper);
}

/**
 * Append a new transaction row to the bus log.
 * @param bus - "SPI" or "I2C"
 * @param timestamp_ms - event timestamp in milliseconds
 * @param data - event data containing direction, size, and data fields
 */
export function appendBusEntry(
  bus: "SPI" | "I2C",
  timestamp_ms: number,
  data: Record<string, unknown>
): void {
  const tbody = document.getElementById("bus-log-body");
  if (!tbody) return;

  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${timestamp_ms}ms</td>
    <td>${bus}</td>
    <td>${data.direction || "tx"}</td>
    <td>${data.size || "?"}</td>
    <td class="bus-data">${data.data || ""}</td>
  `;
  tbody.appendChild(row);

  // Auto-scroll to bottom
  const scrollParent = tbody.closest(".bus-log-scroll");
  if (scrollParent) scrollParent.scrollTop = scrollParent.scrollHeight;
}

/**
 * Clear all rows from the bus log for a new simulation run.
 */
export function clearBusLog(): void {
  const tbody = document.getElementById("bus-log-body");
  if (tbody) tbody.innerHTML = "";
}
