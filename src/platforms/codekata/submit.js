// src/platforms/codekata/submit.js

// Inject main-world bridge to access full Ace Editor instance
function injectCodeKataBridge() {
  if (document.getElementById("cp-gitsync-ck-bridge")) return;
  const s = document.createElement("script");
  s.id = "cp-gitsync-ck-bridge";
  s.src = chrome.runtime.getURL("src/platforms/codekata/inject.js");
  s.onload = function () {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(s);
}

injectCodeKataBridge();

let latestCapturedCode = "";

window.addEventListener("CP_GITSYNC_CODEKATA_CODE_EXPORT", (e) => {
  if (e.detail && e.detail.code) {
    latestCapturedCode = e.detail.code;
  }
});

function fallbackScrapeEditor() {
  const ta = document.querySelector("#editor textarea.ace_text-input, textarea.ace_text-input");
  if (ta && ta.value) return ta.value;

  const lines = document.querySelectorAll("#editor .ace_line, .ace_editor .ace_line");
  if (lines && lines.length > 0) {
    return Array.from(lines).map((l) => l.textContent).join("\n");
  }
  return "";
}

function extractCodeKataLanguage() {
  const singleVal = document.querySelector(".ss-single, .ss-values");
  if (singleVal && singleVal.textContent.trim()) {
    return singleVal.textContent.trim();
  }

  const nativeSelect =
    document.getElementById("editorModeSelectDesktop") ||
    document.getElementById("editorModeSelectMobile");
  if (nativeSelect && nativeSelect.value) {
    return nativeSelect.value.trim();
  }

  return "Java 8";
}

function listenForCodeKataSubmission() {
  document.addEventListener(
    "click",
    (e) => {
      if (!e.isTrusted) return;

      const target = e.target;
      if (!target) return;

      if (
        target.closest(".ss-main") ||
        target.closest(".layout-change-container") ||
        target.closest(".ace_editor") ||
        target.closest(".run-code")
      ) {
        return;
      }

      const btn = target.closest("button");
      if (!btn) return;

      const btnClass = (btn.className || "").toLowerCase();
      const btnText = (btn.textContent || "").trim().toLowerCase();

      const isSubmit =
        btnClass.includes("submit-code") ||
        btnText === "submit" ||
        btnText.startsWith("submit");

      if (!isSubmit || btnText.includes("run")) {
        return;
      }

      console.log("[CP-GitSync] CodeKata Submit button clicked.");

      // Request complete code from injected bridge script
      window.dispatchEvent(new CustomEvent("CP_GITSYNC_REQUEST_CODEKATA_CODE"));

      setTimeout(() => {
        const sourceCode = latestCapturedCode || fallbackScrapeEditor();
        const language = extractCodeKataLanguage();
        const submissionId = `ck_${Date.now()}`;

        chrome.storage.local.set({
          codekata_active_submission: {
            submissionId: submissionId,
            language: language,
            sourceCode: sourceCode || "// CodeKata Solution",
            timestamp: Date.now()
          },
          codekata_pending_verdict: true
        });
      }, 300);
    },
    true
  );
}

listenForCodeKataSubmission();