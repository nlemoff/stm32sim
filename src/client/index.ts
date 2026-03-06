/**
 * @module client/index
 * @description Application bootstrap.
 * Initializes the CodeMirror editor, loads samples into the dropdown,
 * and sets up file upload. Exports key modules for Plan 03.
 */
import { initEditor, getCode, setCode, setupFileUpload } from "./editor/editor";
import { listSamples, getSample } from "./sim/api";
import { SimConnection } from "./sim/websocket";
import { getStatus, setStatus, onStatusChange } from "./sim/state";

// Initialize editor
const editorContainer = document.getElementById("editor-container")!;
const editorView = initEditor(editorContainer);

// Set up file upload
const fileInput = document.getElementById("file-upload") as HTMLInputElement;
setupFileUpload(fileInput);

// Create shared SimConnection instance
const simConnection = new SimConnection();

// Load samples into dropdown
const sampleSelect = document.getElementById("sample-select") as HTMLSelectElement;

async function loadSamples() {
  try {
    const data = await listSamples();
    if (data.samples && Array.isArray(data.samples)) {
      for (const sample of data.samples) {
        const option = document.createElement("option");
        option.value = sample.name;
        option.textContent = sample.title || sample.name;
        sampleSelect.appendChild(option);
      }
    }
  } catch (err) {
    console.warn("Failed to load samples:", err);
  }
}

// Handle sample selection
sampleSelect.addEventListener("change", async () => {
  const name = sampleSelect.value;
  if (!name) return;
  try {
    const sample = await getSample(name);
    if (sample.code) {
      setCode(sample.code);
    }
  } catch (err) {
    console.error("Failed to load sample:", err);
  }
});

// Initialize on DOM ready
loadSamples();

// Export for Plan 03 (GPIO visualization, controls)
export { editorView, getCode, setCode, simConnection, getStatus, setStatus, onStatusChange };
