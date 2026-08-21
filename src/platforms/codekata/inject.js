// src/platforms/codekata/inject.js

(function () {
  function getCodeFromPageContext() {
    let code = "";

    try {
      const editorEl = document.getElementById("editor") || document.querySelector(".ace_editor");
      if (editorEl && window.ace) {
        const editor = window.ace.edit(editorEl);
        if (editor) {
          code = editor.getValue();
        }
      }
    } catch (e) {}

    if (!code) {
      const editorEl = document.getElementById("editor") || document.querySelector(".ace_editor");
      if (editorEl && editorEl.env && editorEl.env.editor) {
        code = editorEl.env.editor.getValue();
      }
    }

    return code || "";
  }

  window.addEventListener("CP_GITSYNC_REQUEST_CODEKATA_CODE", function () {
    const fullCode = getCodeFromPageContext();
    window.dispatchEvent(
      new CustomEvent("CP_GITSYNC_CODEKATA_CODE_EXPORT", {
        detail: { code: fullCode }
      })
    );
  });
})();