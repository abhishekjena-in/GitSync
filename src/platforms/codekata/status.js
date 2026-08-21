// src/platforms/codekata/status.js

function isExtensionValid() {
  return typeof chrome !== "undefined" && chrome.runtime && !!chrome.runtime.id;
}

// Check for fresh evaluation state
function extractAccurateVerdict() {
  // 1. DEDICATED ACTIVE VERDICT ANSWER HEADER
  const passedSpan = document.querySelector(".passed, [class*='passed']");
  if (passedSpan && !passedSpan.hasAttribute("data-gitsync-stale")) {
    const text = passedSpan.textContent.trim().toLowerCase();
    if (text.includes("correct") || text.includes("passed") || text === "accepted") {
      return "Accepted";
    }
  }

  const failedSpan = document.querySelector(".failed, [class*='failed']");
  if (failedSpan && !failedSpan.hasAttribute("data-gitsync-stale")) {
    const text = failedSpan.textContent.trim().toLowerCase();
    if (text.includes("wrong") || text.includes("failed")) {
      return "Wrong Answer";
    }
  }

  // 2. CHECK VERDICT BANNER CONTAINER
  const verdictBanner = document.querySelector(".⭐️igxhb5-0, [class*='igxhb5']");
  if (verdictBanner && !verdictBanner.hasAttribute("data-gitsync-stale")) {
    const bannerText = verdictBanner.textContent.toLowerCase();

    if (bannerText.includes("running") || bannerText.includes("evaluating") || bannerText.includes("processing")) {
      return null;
    }

    if (bannerText.includes("correct answer") || bannerText.includes("passed")) {
      return "Accepted";
    }
    if (bannerText.includes("wrong answer")) {
      return "Wrong Answer";
    }

    const tcMatch = bannerText.match(/(\d+)\s*\/\s*(\d+)/);
    if (tcMatch) {
      const p = parseInt(tcMatch[1], 10);
      const t = parseInt(tcMatch[2], 10);
      if (t > 0) {
        return p === t ? "Accepted" : "Wrong Answer";
      }
    }
  }

  return null;
}

let isSyncing = false;

// Mark existing DOM results as stale when Submit is pressed
document.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const txt = (btn.textContent || "").trim().toLowerCase();
  const cls = (btn.className || "").toLowerCase();

  if (cls.includes("submit-code") || txt === "submit" || txt.startsWith("submit")) {
    document.querySelectorAll(".passed, .failed, .⭐️igxhb5-0, [class*='igxhb5']").forEach((el) => {
      el.setAttribute("data-gitsync-stale", "true");
    });
  }
}, true);

function observeRealtimeSubmission() {
  const checkVerdict = () => {
    if (!isExtensionValid() || isSyncing) return;

    chrome.storage.local.get(
      ["codekata_active_submission", "codekata_pending_verdict", "current_problem", "all_submissions"],
      (res) => {
        if (!isExtensionValid()) return;
        if (!res.codekata_pending_verdict || !res.codekata_active_submission) return;

        const finalVerdict = extractAccurateVerdict();
        if (!finalVerdict) return;

        isSyncing = true;
        const pending = res.codekata_active_submission;
        const problem = res.current_problem || {};
        const history = res.all_submissions || [];

        // Clear active submission flag immediately
        chrome.storage.local.set(
          {
            codekata_pending_verdict: false,
            codekata_active_submission: null
          },
          () => {
            const fullRecord = {
              platform: "CodeKata",
              submissionId: pending.submissionId,
              urlSubpath: problem.urlSubpath || "",
              problemName: problem.title || "CodeKata Problem",
              language: pending.language || "Java 8",
              verdict: finalVerdict,
              sourceCode: pending.sourceCode || "// Captured from CodeKata",
              problemDetails: problem,
              capturedAt: new Date().toISOString()
            };

            console.log("[CP-GitSync] Synced CodeKata Solution -> Verdict:", finalVerdict, "| Lang:", pending.language);

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

  // Immediate event-based detection via MutationObserver
  const observer = new MutationObserver(() => checkVerdict());
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  setInterval(checkVerdict, 300);
}

observeRealtimeSubmission();