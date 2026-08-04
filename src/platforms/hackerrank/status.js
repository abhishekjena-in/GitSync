// src/platforms/hackerrank/status.js

function showUISuccess(msg) {
  const toast = document.createElement("div");
  toast.className = "cf-sync-toast success";
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function extractHackerRankVerdict() {
  // 1. Check for Accepted / Congratulations state
  const congratsHeading = document.querySelector(".congrats-heading");
  const congratsText = document.querySelector(".congrats-text");
  if (congratsHeading || congratsText) {
    const headingVal = congratsHeading ? congratsHeading.textContent.toLowerCase() : "";
    const textVal = congratsText ? congratsText.textContent.toLowerCase() : "";
    if (headingVal.includes("congratulations") || textVal.includes("solved this challenge")) {
      return "Accepted";
    }
  }

  // 2. Check for Compilation Error or Runtime Error heading
  const statusErrorEl = document.querySelector(".status.compile-error") || document.querySelector(".status");
  if (statusErrorEl) {
    const errText = statusErrorEl.textContent.trim().toLowerCase();
    if (errText.includes("compilation error")) return "Compilation Error";
    if (errText.includes("runtime error")) return "Runtime Error";
    if (errText.includes("wrong answer")) return "Wrong Answer";
  }

  // 3. Check test case icons for failure (Wrong Answer)
  const failedTab = document.querySelector(".tab-item-color-error");
  if (failedTab && !document.querySelector(".congrats-wrapper")) {
    return "Wrong Answer";
  }

  // Fallback check
  const genericStatus = document.querySelector(".submission-status") || document.querySelector(".status-icon");
  if (genericStatus) {
    const raw = genericStatus.textContent.trim().toLowerCase();
    if (raw.includes("processing") || raw.includes("queued") || raw.includes("running") || raw.includes("started")) {
      return null;
    }
    if (raw.includes("accepted")) return "Accepted";
  }

  return null;
}

const processedSubmissionIds = new Set();
let isCurrentlySyncing = false;

function trackHackerRankVerdictCompletion() {
  const targetNode = document.body;
  if (!targetNode) return;

  const observer = new MutationObserver(() => {
    if (isCurrentlySyncing) return;

    const finalVerdict = extractHackerRankVerdict();
    if (!finalVerdict) return;

    chrome.storage.local.get(
      ["pending_submission", "current_problem", "all_submissions", "hackerrank_verdict_processed"],
      (res) => {
        const pending = res.pending_submission || {};
        const subId = pending.submissionId || `hr_${pending.timestamp || Date.now()}`;

        if (res.hackerrank_verdict_processed || processedSubmissionIds.has(subId) || isCurrentlySyncing) {
          return;
        }

        // SYNCHRONOUS LOCK
        isCurrentlySyncing = true;
        processedSubmissionIds.add(subId);

        chrome.storage.local.set({ hackerrank_verdict_processed: true }, () => {
          const problem = res.current_problem || {};
          const history = res.all_submissions || [];

          const fullRecord = {
            platform: "HackerRank",
            submissionId: subId,
            urlSubpath: problem.urlSubpath || "",
            problemName: problem.title || "Unknown Problem",
            language: pending.language || "Source Code",
            verdict: finalVerdict,
            sourceCode: pending.sourceCode || "// Captured from HackerRank submission",
            problemDetails: problem,
            capturedAt: new Date().toISOString()
          };

          console.log("[CP-GitSync] Syncing payload to background:", subId, finalVerdict);

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
    showUISuccess("Successfully synced HackerRank submission to GitHub!");
  }
});

trackHackerRankVerdictCompletion();