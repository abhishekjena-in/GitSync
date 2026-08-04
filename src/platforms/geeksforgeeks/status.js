// src/platforms/geeksforgeeks/status.js

function showUISuccess(msg) {
  const toast = document.createElement("div");
  toast.className = "cf-sync-toast success";
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function extractGFGVerdict() {
  const headerEl =
    document.querySelector(".problems_geekbot_header__d7S7A h3") ||
    document.querySelector(".problems_content_pane__nexJa h3");

  if (headerEl) {
    const text = headerEl.textContent.trim().toLowerCase();

    if (text.includes("compilation error") || text.includes("compile error")) {
      return "Compilation Error";
    }
    if (text.includes("runtime error")) {
      return "Runtime Error";
    }
    if (
      text.includes("correct answer") ||
      text.includes("problem solved successfully") ||
      text === "correct" ||
      text === "accepted"
    ) {
      return "Accepted";
    }
    if (text.includes("wrong answer")) {
      return "Wrong Answer";
    }
    if (text.includes("time limit") || text.includes("tle")) {
      return "Time Limit Exceeded";
    }
  }

  const candidateNodes = document.querySelectorAll(
    ".problems_output_window__G_LTH, [class*='output_window'], [class*='status'], [class*='verdict'], [class*='result'], [class*='geekbot_header'], h2, h3, h4, span, div, strong"
  );

  for (const node of candidateNodes) {
    if (!node || !node.textContent) continue;
    if (node.children.length > 6) continue;

    const txt = node.textContent.trim().toLowerCase();

    if (
      txt === "running" ||
      txt === "compiling" ||
      txt === "evaluating" ||
      txt.includes("compiling...") ||
      txt.includes("running test cases...")
    ) {
      return null;
    }

    if (
      txt.includes("problem solved successfully") ||
      txt.includes("correct answer") ||
      txt === "correct" ||
      txt === "accepted" ||
      txt.includes("100/100") ||
      txt.includes("100%")
    ) {
      return "Accepted";
    }

    if (txt.includes("wrong answer")) return "Wrong Answer";
    if (txt.includes("time limit") || txt === "tle") return "Time Limit Exceeded";
    if (txt.includes("compilation error") || txt.includes("compile error")) return "Compilation Error";
    if (txt.includes("runtime error") || txt === "rte") return "Runtime Error";
  }

  return null;
}

const processedSubmissionIds = new Set();
let isCurrentlySyncing = false;

function trackGFGVerdictCompletion() {
  const targetNode = document.body;
  if (!targetNode) return;

  const observer = new MutationObserver(() => {
    if (isCurrentlySyncing) return;

    const finalVerdict = extractGFGVerdict();
    if (!finalVerdict) return;

    chrome.storage.local.get(
      ["pending_submission", "current_problem", "all_submissions", "gfg_verdict_processed"],
      (res) => {
        const pending = res.pending_submission || {};
        const subId = pending.submissionId;

        // Skip if there's no active pending submission or if this ID was already processed
        if (!subId || res.gfg_verdict_processed || processedSubmissionIds.has(subId) || isCurrentlySyncing) {
          return;
        }

        // SYNCHRONOUS LOCK
        isCurrentlySyncing = true;
        processedSubmissionIds.add(subId);

        chrome.storage.local.set({ gfg_verdict_processed: true }, () => {
          const problem = res.current_problem || {};
          const history = res.all_submissions || [];

          const fullRecord = {
            platform: "GeeksforGeeks",
            submissionId: subId,
            urlSubpath: problem.urlSubpath || "",
            problemName: problem.title || "Unknown Problem",
            language: pending.language || "Source Code",
            verdict: finalVerdict,
            sourceCode: pending.sourceCode || "// Captured from GeeksforGeeks",
            problemDetails: problem,
            capturedAt: new Date().toISOString()
          };

          console.log("[CP-GitSync] Dispatching payload to GitHub Engine:", fullRecord);

          history.push(fullRecord);
          chrome.storage.local.set({ all_submissions: history }, () => {
            chrome.runtime.sendMessage({ action: "SYNC_TO_GITHUB", data: fullRecord });

            setTimeout(() => {
              isCurrentlySyncing = false;
            }, 1000);
          });
        });
      }
    );
  });

  observer.observe(targetNode, { childList: true, subtree: true, characterData: true });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "SYNC_SUCCESS") {
    showUISuccess("Successfully synced GeeksforGeeks submission to GitHub!");
  }
});

trackGFGVerdictCompletion();