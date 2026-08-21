// src/platforms/codechef/submit.js

function extractCodeChefCode() {
  // 1. Read directly from Ace Editor instance
  try {
    const aceEl = document.getElementById("submit-ide-v2") || document.querySelector(".ace_editor");
    if (aceEl && window.ace) {
      const editor = window.ace.edit(aceEl);
      if (editor) {
        const val = editor.getValue();
        if (val && val.trim()) return val.trim();
      }
    }
  } catch (e) {}

  // 2. Read from Ace rendered lines
  const aceLines = document.querySelectorAll("#submit-ide-v2 .ace_line, .ace_editor .ace_line");
  if (aceLines && aceLines.length > 0) {
    const code = Array.from(aceLines)
      .map((line) => line.textContent)
      .join("\n");
    if (code.trim()) return code.trim();
  }

  // 3. Fallback: Textarea
  const ta = document.querySelector(".ace_text-input, textarea");
  if (ta && ta.value) return ta.value.trim();

  return "";
}

function extractCompilerLanguage() {
  // 1. Language Combobox Text inside IDE Header
  const langSelect =
    document.getElementById("language-select") ||
    document.querySelector("._language__select_1pb9c_35") ||
    document.querySelector("._language_select__button_bh3c4_144");

  if (langSelect) {
    const txt = langSelect.textContent.trim();
    if (txt && !txt.toLowerCase().includes("select")) {
      return txt;
    }
  }

  // 2. Hidden native input value
  const nativeInput = document.querySelector("input.MuiSelect-nativeInput");
  if (nativeInput && nativeInput.value) {
    return nativeInput.value.trim();
  }

  return "Java";
}

function listenForSubmit() {
  document.addEventListener(
    "click",
    (e) => {
      if (!e.isTrusted) return;

      const target = e.target;
      if (!target) return;

      // Ignore language dropdown, custom input toggle, settings, visualizer
      if (
        target.closest("#language-select") ||
        target.closest("[role='listbox']") ||
        target.closest("[role='option']") ||
        target.closest("._testcaseContainer_yibw2_411") ||
        target.closest("#compile_btn") ||
        target.closest("._settings_1fs8l_2") ||
        target.closest(".ace_editor")
      ) {
        return;
      }

      // Strictly target #submit_btn / ._submit__btn_yibw2_333
      const submitBtn = target.closest("#submit_btn, ._submit__btn_yibw2_333");
      if (!submitBtn) return;

      console.log("[CP-GitSync] CodeChef Submit button clicked.");

      setTimeout(() => {
        const sourceCode = extractCodeChefCode();
        const language = extractCompilerLanguage();
        const submissionId = `cc_${Date.now()}`;

        chrome.storage.local.set({
          codechef_active_submission: {
            submissionId: submissionId,
            language: language,
            sourceCode: sourceCode || "// CodeChef Solution",
            timestamp: Date.now()
          },
          codechef_pending_verdict: true
        });
      }, 250);
    },
    true
  );
}

listenForSubmit();