/**
 * @module client/editor/editor
 * @description CodeMirror 6 editor setup with C syntax highlighting,
 * file upload, and sample loading support.
 */
import { EditorView, basicSetup } from "codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorState } from "@codemirror/state";

const defaultCode = `#include "stm32f4xx_hal.h"

int main(void) {
  HAL_Init();

  // Configure PA5 as output (onboard LED on Nucleo)
  GPIO_InitTypeDef gpio = {0};
  gpio.Pin = GPIO_PIN_5;
  gpio.Mode = GPIO_MODE_OUTPUT_PP;
  HAL_GPIO_Init(GPIOA, &gpio);

  while (1) {
    HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
    HAL_Delay(500);
  }
}
`;

let view: EditorView;

/**
 * Initialize the CodeMirror editor in the given container element.
 * Returns the EditorView instance.
 */
export function initEditor(container: HTMLElement): EditorView {
  const state = EditorState.create({
    doc: defaultCode,
    extensions: [
      basicSetup,
      cpp(),
      oneDark,
      EditorView.theme({
        "&": { height: "100%" },
        ".cm-scroller": { overflow: "auto" },
      }),
    ],
  });

  view = new EditorView({
    state,
    parent: container,
  });

  return view;
}

/**
 * Get the current editor content as a string.
 */
export function getCode(): string {
  return view.state.doc.toString();
}

/**
 * Replace the entire editor content with the given code.
 */
export function setCode(code: string): void {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: code },
  });
}

/**
 * Set up a file input element to load .c/.h files into the editor.
 * Listens for the change event, reads the file content, and calls setCode().
 */
export function setupFileUpload(inputEl: HTMLInputElement): void {
  inputEl.addEventListener("change", async () => {
    const file = inputEl.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCode(text);
    inputEl.value = ""; // Reset so same file can be re-uploaded
  });
}
