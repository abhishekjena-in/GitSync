// src/platforms/hackerrank/submit.js

function extractHackerRankCode() {
  let code = "";

  // 1. Try reading from the underlying textarea (HackerRank syncs code here continuously)
  const textareas = document.querySelectorAll("textarea");
  for (const ta of textareas) {
    if (ta.value && ta.value.trim().length > 0) {
      code = ta.value;
      break;
    }
  }

  // 2. Try reading DOM lines if visible
  if (!code) {
    const lines = document.querySelectorAll(".view-line");
    if (lines && lines.length > 0) {
      code = Array.from(lines)
        .map((line) => line.textContent)
        .join("\n");
    }
  }

  // 3. Fallback: Query CodeMirror if on older HackerRank interface
  if (!code) {
    const cm = document.querySelector(".CodeMirror");
    if (cm && cm.CodeMirror) {
      code = cm.CodeMirror.getValue();
    }
  }

  return code.trim();
}

function listenForHackerRankSubmission() {
  // Use event capturing at document root to intercept clicks before HackerRank blocks them
  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest("button") || e.target;
      if (!btn) return;

      const btnText = (btn.textContent || "").toLowerCase();

      if (btnText.includes("submit") || btnText.includes("run code")) {
        console.log("[CP-GitSync] HackerRank Submit button detected!");

        setTimeout(() => {
          const sourceCode = extractHackerRankCode();

          // Read language selector
          const langEl =
            document.querySelector(".select-language") ||
            document.querySelector(".ms-select") ||
            document.querySelector(".language-selector") ||
            document.querySelector("[class*='select-language']");

          const selectedLanguage = langEl ? langEl.textContent.trim() : "C++";

          const pendingSubmission = {
            language: selectedLanguage,
            sourceCode: sourceCode || "// Source captured from HackerRank",
            timestamp: Date.now()
          };

          chrome.storage.local.set({ pending_submission: pendingSubmission }, () => {
            console.log(
              "[CP-GitSync] Saved HackerRank submission! Code length:",
              sourceCode.length,
              "Language:",
              selectedLanguage
            );
          });
        }, 300); // Small timeout allows HackerRank form state to flush code into textarea
      }
    },
    true
  );
}

listenForHackerRankSubmission();