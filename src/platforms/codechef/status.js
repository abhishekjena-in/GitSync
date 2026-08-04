// src/platforms/codechef/status.js

function showUISuccess(msg) {
  const toast = document.createElement("div");
  toast.className = "cf-sync-toast success";
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function extractCodeChefVerdict() {
  // 1. DIRECT CHECK FOR CODECHEF SUBTASK TABLE & RESULTS
  const statusTable = document.querySelector(".status-table");
  if (statusTable) {
    const tableText = statusTable.textContent.toLowerCase();

    // Check for 100% / Correct
    if (
      tableText.includes("subtask score: 100%") ||
      tableText.includes("total score = 100%") ||
      tableText.includes("result - correct") ||
      tableText.includes("correct")
    ) {
      return "Accepted";
    }

    if (tableText.includes("wrong") || tableText.includes("subtask score: 0%")) {
      return "Wrong Answer";
    }
  }

  // 2. BROAD QUERY ACROSS THE PAGE FOR OTHER VERDICTS
  const candidateNodes = document.querySelectorAll(
    "[class*='status'], [class*='verdict'], [class*='result'], [class*='subtask'], .status-table, h2, h3, h4, span, td, strong"
  );

  for (const node of candidateNodes) {
    if (!node || !node.textContent) continue;

    // Skip generic top-level containers
    if (node.children.length > 5) continue;

    const txt = node.textContent.trim().toLowerCase();

    // Ignore ongoing evaluation states
    if (
      txt === "running" ||
      txt === "compiling" ||
      txt === "queued" ||
      txt === "evaluating" ||
      txt.includes("running...") ||
      txt.includes("compiling...")
    ) {
      return null; // Evaluation in progress
    }

    // Match Accepted
    if (
      txt === "correct" ||
      txt === "correct answer" ||
      txt === "accepted" ||
      txt.includes("result - correct") ||
      txt.includes("subtask score: 100%") ||
      txt.includes("total score = 100%") ||
      txt.includes("100/100") ||
      txt.includes("100 pts")
    ) {
      return "Accepted";
    }

    // Match Failures
    if (txt === "wrong answer" || txt.includes("wrong answer")) {
      return "Wrong Answer";
    }
    if (txt.includes("time limit") || txt === "tle") {
      return "Time Limit Exceeded";
    }
    if (txt.includes("compilation error") || txt.includes("compile error")) {
      return "Compilation Error";
    }
    if (txt.includes("runtime error") || txt === "rte") {
      return "Runtime Error";
    }
  }

  return null;
}

const processedSubmissionIds = new Set();
let isCurrentlySyncing = false;

function trackCodeChefVerdictCompletion() {
  const targetNode = document.body;
  if (!targetNode) return;

  const observer = new MutationObserver(() => {
    if (isCurrentlySyncing) return;

    const finalVerdict = extractCodeChefVerdict();
    if (!finalVerdict) return;

    chrome.storage.local.get(
      ["pending_submission", "current_problem", "all_submissions", "codechef_verdict_processed"],
      (res) => {
        const pending = res.pending_submission || {};
        const subId = pending.submissionId || `cc_${pending.timestamp || Date.now()}`;

        if (res.codechef_verdict_processed || processedSubmissionIds.has(subId) || isCurrentlySyncing) {
          return;
        }

        // SYNCHRONOUS LOCK
        isCurrentlySyncing = true;
        processedSubmissionIds.add(subId);

        chrome.storage.local.set({ codechef_verdict_processed: true }, () => {
          const problem = res.current_problem || {};
          const history = res.all_submissions || [];

          const fullRecord = {
            platform: "CodeChef",
            submissionId: subId,
            urlSubpath: problem.urlSubpath || "",
            problemName: problem.title || "Unknown Problem",
            language: pending.language || "Source Code",
            verdict: finalVerdict,
            sourceCode: pending.sourceCode || "// Captured from CodeChef",
            problemDetails: problem,
            capturedAt: new Date().toISOString()
          };

          console.log("[CP-GitSync] Extracted Final CodeChef Verdict:", finalVerdict, "ID:", subId);

          history.push(fullRecord);
          chrome.storage.local.set({ all_submissions: history }, () => {
            chrome.runtime.sendMessage({ action: "SYNC_TO_GITHUB", data: fullRecord });

            setTimeout(() => {
              isCurrentlySyncing = false;
            }, 1500);
          });
        });
      }
    );
  });

  observer.observe(targetNode, { childList: true, subtree: true, characterData: true });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "SYNC_SUCCESS") {
    showUISuccess("Successfully synced CodeChef submission to GitHub!");
  }
});

trackCodeChefVerdictCompletion();