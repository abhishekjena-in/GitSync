// src/platforms/hackerrank/submit.js

function extractFullSourceCode() {
  let sourceCode = "";

  // 1. Try Monaco internal API (Most reliable full capture)
  try {
    if (window.monaco && window.monaco.editor) {
      const editors = window.monaco.editor.getEditors();
      if (editors && editors.length > 0) {
        sourceCode = editors[0].getValue();
      }
    }
  } catch (e) {
    console.warn("[CP-GitSync] Monaco direct API read fallback:", e);
  }

  // 2. Try CodeMirror
  if (!sourceCode) {
    try {
      const cmEl = document.querySelector(".CodeMirror");
      if (cmEl && cmEl.CodeMirror) {
        sourceCode = cmEl.CodeMirror.getValue();
      }
    } catch (e) {}
  }

  // 3. Fallback: Aggregate view lines from DOM
  if (!sourceCode) {
    const lineElements = document.querySelectorAll(".view-line");
    if (lineElements && lineElements.length > 0) {
      sourceCode = Array.from(lineElements)
        .map((el) => el.textContent)
        .join("\n");
    }
  }

  // 4. Fallback: Any populated textarea
  if (!sourceCode) {
    const textareas = document.querySelectorAll("textarea");
    for (const ta of textareas) {
      if (ta.value && ta.value.trim().length > 5) {
        sourceCode = ta.value;
        break;
      }
    }
  }

  return sourceCode ? sourceCode.trim() : "";
}

function listenForHackerRankSubmission() {
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest("button") || e.target;
      if (!btn) return;

      const btnText = (btn.textContent || "").toLowerCase();

      if (btnText.includes("submit") || btnText.includes("run code")) {
        console.log("[CP-GitSync] Submit clicked. Capturing full source code...");

        setTimeout(() => {
          const fullCode = extractFullSourceCode();

          const langEl =
            document.querySelector(".select-language") ||
            document.querySelector(".ms-select") ||
            document.querySelector(".language-selector") ||
            document.querySelector("[class*='select-language']");

          const selectedLanguage = langEl ? langEl.textContent.trim() : "C++";
          
          // CLEAN SUBMISSION ID: Strictly 'hr_<timestamp>' with NO embedded 'attempt' string
          const submissionId = `hr_${Date.now()}`;

          const pendingSubmission = {
            submissionId: submissionId,
            language: selectedLanguage,
            sourceCode: fullCode || "// Source captured from HackerRank submission",
            timestamp: Date.now()
          };

          chrome.storage.local.set(
            {
              pending_submission: pendingSubmission,
              hackerrank_verdict_processed: false
            },
            () => {
              console.log(
                `[CP-GitSync] Code captured (${fullCode.length} chars). ID: ${submissionId}`
              );
            }
          );
        }, 200);
      }
    },
    true
  );
}

listenForHackerRankSubmission();