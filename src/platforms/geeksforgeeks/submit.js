// src/platforms/geeksforgeeks/submit.js

function extractGFGAceCode() {
  let code = "";

  // 1. DIRECT ACE EDITOR INSTANCE
  try {
    const aceEl = document.getElementById("ace-editor") || document.querySelector(".ace_editor");
    if (aceEl && window.ace) {
      const editor = window.ace.edit(aceEl);
      if (editor) {
        code = editor.getValue();
      }
    }
  } catch (e) {
    console.warn("[CP-GitSync] Ace API read fallback:", e);
  }

  // 2. SCRAPE ALL ACE LINES FROM DOM
  if (!code) {
    const aceLines = document.querySelectorAll("#ace-editor .ace_line, .ace_line");
    if (aceLines && aceLines.length > 0) {
      code = Array.from(aceLines)
        .map((line) => line.textContent)
        .join("\n");
    }
  }

  // 3. TEXTAREA FALLBACK
  if (!code) {
    const textarea = document.querySelector("#ace-editor textarea.ace_text-input");
    if (textarea && textarea.value) {
      code = textarea.value;
    }
  }

  return code ? code.trim() : "";
}

function extractGFGLanguage() {
  const langDivider = document.querySelector(".problems_language_dropdown__DgjFb .divider.text");
  const activeLangItem = document.querySelector(".problems_language_dropdown__DgjFb .active.selected.item");

  let rawLang = langDivider ? langDivider.textContent.trim() : "";
  if (!rawLang && activeLangItem) {
    rawLang = activeLangItem.textContent.trim();
  }

  if (rawLang.toLowerCase().includes("java") && !rawLang.toLowerCase().includes("script")) return "Java";
  if (rawLang.toLowerCase().includes("c++")) return "C++";
  if (rawLang.toLowerCase().includes("python")) return "Python";
  if (rawLang.toLowerCase().includes("javascript") || rawLang.toLowerCase().includes("js")) return "JavaScript";
  if (rawLang.toLowerCase().includes("c#")) return "C#";

  return rawLang || "C++";
}

function listenForGFGSubmission() {
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest(".problems_submit_button__6QoNQ, button") || e.target;
      if (!btn) return;

      const btnText = (btn.textContent || "").trim().toLowerCase();

      if (btnText === "submit" || btn.classList.contains("problems_submit_button__6QoNQ")) {
        console.log("[CP-GitSync] GFG Submit clicked! Resetting submission state...");

        setTimeout(() => {
          const sourceCode = extractGFGAceCode();
          const selectedLanguage = extractGFGLanguage();
          const submissionId = `gfg_${Date.now()}`;

          const pendingSubmission = {
            submissionId: submissionId,
            language: selectedLanguage,
            sourceCode: sourceCode || "// Captured from GeeksforGeeks",
            timestamp: Date.now()
          };

          // RESET VERDICT LOCK ON NEW SUBMIT
          chrome.storage.local.set(
            {
              pending_submission: pendingSubmission,
              gfg_verdict_processed: false
            },
            () => {
              console.log(
                `[CP-GitSync] Captured fresh GFG code (${sourceCode.length} chars). ID: ${submissionId}`
              );
            }
          );
        }, 250);
      }
    },
    true
  );
}

listenForGFGSubmission();