// src/platforms/codechef/status.js

function isExtensionValid() {
  return typeof chrome !== "undefined" && chrome.runtime && !!chrome.runtime.id;
}

function extractVerdictFromRunTab() {
  const runContainer =
    document.querySelector("._run-result_1xnpw_2") ||
    document.querySelector("._runTab_yibw2_566") ||
    document.querySelector("._ide-execute__wrapper_r2w6z_20") ||
    document.body;

  if (!runContainer) return null;

  const fullText = runContainer.textContent.toLowerCase();

  // In-progress evaluation states
  if (
    fullText.includes("running...") ||
    fullText.includes("judging...") ||
    fullText.includes("evaluating...") ||
    fullText.includes("compiling...")
  ) {
    return null;
  }

  // 1. Direct check on status container label / header
  const statusLabel = document.querySelector(
    "._status__container_1xnpw_48 span, ._status__container_1xnpw_48, ._run__container_1xnpw_42, [class*='status-error']"
  );
  if (statusLabel) {
    const labelText = statusLabel.textContent.trim().toLowerCase();
    if (
      labelText.includes("runtime error") ||
      labelText.includes("run time error") ||
      labelText.includes("sigsegv") ||
      labelText.includes("nzec") ||
      labelText.includes("sigabrt")
    ) {
      return "Runtime Error";
    }
    if (labelText.includes("compilation error") || labelText.includes("compile error")) {
      return "Compilation Error";
    }
    if (labelText.includes("time limit") || labelText.includes("tle")) {
      return "Time Limit Exceeded";
    }
    if (labelText.includes("wrong answer")) return "Wrong Answer";
    if (labelText.includes("correct") || labelText.includes("accepted")) return "Accepted";
  }

  // 2. Subtask Table Evaluation
  const statusTable = document.querySelector(".status-table");
  if (statusTable) {
    const tableText = statusTable.textContent.toLowerCase();
    if (tableText.includes("total score = 100%") || tableText.includes("subtask score: 100%")) {
      return "Accepted";
    }
    if (
      tableText.includes("run time error") ||
      tableText.includes("runtime error") ||
      tableText.includes("nzec") ||
      tableText.includes("sigsegv")
    ) {
      return "Runtime Error";
    }
    if (tableText.includes("compile error") || tableText.includes("compilation error")) {
      return "Compilation Error";
    }
    if (tableText.includes("time limit") || tableText.includes("tle")) {
      return "Time Limit Exceeded";
    }
    if (tableText.includes("wrong answer") || tableText.includes("total score = 0%")) {
      return "Wrong Answer";
    }
  }

  return null;
}

let isSyncing = false;

function observeCodeChefExecution() {
  const checkVerdict = () => {
    if (!isExtensionValid() || isSyncing) return;

    chrome.storage.local.get(
      ["codechef_active_submission", "codechef_pending_verdict", "current_problem", "all_submissions"],
      (res) => {
        if (!isExtensionValid()) return;
        if (!res.codechef_pending_verdict || !res.codechef_active_submission) return;

        const finalVerdict = extractVerdictFromRunTab();
        if (!finalVerdict) return;

        isSyncing = true;
        const pending = res.codechef_active_submission;
        const problem = res.current_problem || {};
        const history = res.all_submissions || [];

        // Clear active state immediately
        chrome.storage.local.set(
          {
            codechef_pending_verdict: false,
            codechef_active_submission: null
          },
          () => {
            const fullRecord = {
              platform: "CodeChef",
              submissionId: pending.submissionId,
              urlSubpath: problem.urlSubpath || "",
              problemName: problem.title || "CodeChef Problem",
              language: pending.language || "Java",
              verdict: finalVerdict,
              sourceCode: pending.sourceCode || "// Captured from CodeChef",
              problemDetails: problem,
              capturedAt: new Date().toISOString()
            };

            console.log("[CP-GitSync] Synced CodeChef Attempt:", finalVerdict, "Lang:", pending.language);

            history.push(fullRecord);
            chrome.storage.local.set({ all_submissions: history }, () => {
              chrome.runtime.sendMessage({ action: "SYNC_TO_GITHUB", data: fullRecord });

              setTimeout(() => {
                isSyncing = false;
              }, 2500);
            });
          }
        );
      }
    );
  };

  const observer = new MutationObserver(() => checkVerdict());
  const target = document.body;
  if (target) {
    observer.observe(target, { childList: true, subtree: true, characterData: true });
  }

  setInterval(checkVerdict, 800);
}

observeCodeChefExecution();