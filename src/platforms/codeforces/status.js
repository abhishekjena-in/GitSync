// src/platforms/codeforces/status.js

function showUISuccess(msg) {
  if (typeof showCPToast === "function") {
    showCPToast(msg, "success");
  } else {
    const toast = document.createElement("div");
    toast.className = "cf-sync-toast success";
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
}

function verifyDOMStructure() {
  const isStatusPage = window.location.href.includes("/status") || window.location.href.includes("/my");
  if (!isStatusPage) return;

  const table = document.querySelector("table.status-frame-datatable");
  if (!table && typeof notifyDOMChanged === "function") {
    notifyDOMChanged("Codeforces", "Status Table");
  }
}

verifyDOMStructure();

function trackVerdictCompletion() {
  const table = document.querySelector("table.status-frame-datatable");
  if (!table) return;

  const latestRow = table.querySelector("tr[data-submission-id]");
  if (!latestRow) return;

  function inspectAndSync() {
    const cols = latestRow.querySelectorAll("td");
    if (!cols || cols.length < 6) return false;

    const latestSubId = latestRow.getAttribute("data-submission-id");
    const rawVerdict = cols[5]?.innerText.trim() || "";
    const vLower = rawVerdict.toLowerCase();

    if (
      !rawVerdict ||
      vLower.includes("in queue") ||
      vLower.includes("running") ||
      vLower.includes("testing")
    ) {
      return false;
    }

    let targetProblemName = cols[3]?.innerText.trim().replace(/\s+/g, " ") || "";

    const allRows = table.querySelectorAll("tr[data-submission-id]");
    const extractedSubmissions = [];

    allRows.forEach((row) => {
      const rCols = row.querySelectorAll("td");
      if (rCols.length >= 6) {
        const pName = rCols[3]?.innerText.trim().replace(/\s+/g, " ") || "";
        const rVerdict = rCols[5]?.innerText.trim() || "";
        const rVLower = rVerdict.toLowerCase();

        if (
          pName === targetProblemName &&
          rVerdict &&
          !rVLower.includes("in queue") &&
          !rVLower.includes("running") &&
          !rVLower.includes("testing")
        ) {
          extractedSubmissions.push({
            submissionId: row.getAttribute("data-submission-id"),
            when: rCols[1]?.innerText.trim() || "",
            language: rCols[4]?.innerText.trim() || "",
            verdict: rVerdict,
            time: rCols[6]?.innerText.trim() || "0 ms",
            memory: rCols[7]?.innerText.trim() || "0 KB"
          });
        }
      }
    });

    extractedSubmissions.sort((a, b) => parseInt(a.submissionId, 10) - parseInt(b.submissionId, 10));

    extractedSubmissions.forEach((item, index) => {
      item.attemptNumber = index + 1;
    });

    chrome.storage.local.get(["pending_submission", "current_problem", "all_submissions"], (res) => {
      const pending = res.pending_submission || {};
      const problem = res.current_problem || {};
      const history = res.all_submissions || [];

      if (history.some((item) => item.submissionId === latestSubId)) {
        return;
      }

      const currentSubRecord =
        extractedSubmissions.find((s) => s.submissionId === latestSubId) ||
        extractedSubmissions[extractedSubmissions.length - 1];

      const fullRecord = {
        platform: "Codeforces",
        submissionId: latestSubId,
        attemptNumber: currentSubRecord ? currentSubRecord.attemptNumber : extractedSubmissions.length,
        when: currentSubRecord ? currentSubRecord.when : "",
        problemName: targetProblemName || problem.title || "Unknown Problem",
        language: currentSubRecord ? currentSubRecord.language : (pending.language || ""),
        verdict: rawVerdict,
        time: currentSubRecord ? currentSubRecord.time : "0 ms",
        memory: currentSubRecord ? currentSubRecord.memory : "0 KB",
        sourceCode: pending.sourceCode || "",
        problemDetails: problem,
        allProblemSubmissions: extractedSubmissions,
        capturedAt: new Date().toISOString()
      };

      history.push(fullRecord);
      chrome.storage.local.set({ all_submissions: history }, () => {
        chrome.runtime.sendMessage({ action: "SYNC_TO_GITHUB", data: fullRecord });
      });
    });

    return true;
  }

  if (inspectAndSync()) return;

  const observer = new MutationObserver(() => {
    if (inspectAndSync()) {
      observer.disconnect();
    }
  });

  observer.observe(latestRow, { childList: true, subtree: true, characterData: true });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "SYNC_SUCCESS") {
    showUISuccess("Successfully synced submission to GitHub!");
  }
});

trackVerdictCompletion();