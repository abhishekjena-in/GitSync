// src/platforms/codechef/submit.js

function extractCodeChefAceCode() {
  let code = "";

  // 1. READ DIRECTLY FROM ACE EDITOR INSTANCE (Most Accurate)
  try {
    const aceEl = document.getElementById("submit-ide-v2") || document.querySelector(".ace_editor");
    if (aceEl && window.ace) {
      const editor = window.ace.edit(aceEl);
      if (editor) {
        code = editor.getValue();
      }
    }
  } catch (e) {
    console.warn("[CP-GitSync] Could not read Ace Editor via API:", e);
  }

  // 2. FALLBACK: SCRAPE ALL ACE LINES FROM DOM
  if (!code) {
    const aceLines = document.querySelectorAll(".ace_line");
    if (aceLines && aceLines.length > 0) {
      code = Array.from(aceLines)
        .map((line) => line.textContent)
        .join("\n");
    }
  }

  // 3. FALLBACK: READ ACE TEXTAREA
  if (!code) {
    const aceTextarea = document.querySelector(".ace_text-input");
    if (aceTextarea && aceTextarea.value) {
      code = aceTextarea.value;
    }
  }

  return code ? code.trim() : "";
}

function listenForCodeChefSubmission() {
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest("#submit_btn, button") || e.target;
      if (!btn) return;

      const btnId = btn.id || "";
      const btnText = (btn.textContent || "").toLowerCase();

      if (btnId === "submit_btn" || btnText.includes("submit") || btnText.includes("run")) {
        console.log("[CP-GitSync] CodeChef Submit button clicked!");

        setTimeout(() => {
          const sourceCode = extractCodeChefAceCode();

          const langEl =
            document.getElementById("language-select") ||
            document.querySelector(".MuiSelect-select") ||
            document.querySelector("[class*='language']");

          const selectedLanguage = langEl ? langEl.textContent.trim() : "Java";
          const submissionId = `cc_${Date.now()}`;

          const pendingSubmission = {
            submissionId: submissionId,
            language: selectedLanguage,
            sourceCode: sourceCode || "// Source captured from CodeChef",
            timestamp: Date.now()
          };

          chrome.storage.local.set(
            {
              pending_submission: pendingSubmission,
              codechef_verdict_processed: false
            },
            () => {
              console.log(
                `[CP-GitSync] Captured CodeChef code (${sourceCode.length} chars). ID: ${submissionId}`
              );
            }
          );
        }, 200);
      }
    },
    true
  );
}

listenForCodeChefSubmission();