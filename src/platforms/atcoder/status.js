// src/platforms/atcoder/status.js

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
  const isStatusPage = window.location.pathname.includes("/submissions");
  if (!isStatusPage) return;

  const table = document.querySelector("table.table");
  if (!table && typeof notifyDOMChanged === "function") {
    notifyDOMChanged("AtCoder", "Submissions Table");
  }
}

verifyDOMStructure();

function trackVerdictCompletion() {
  const table = document.querySelector("table.table");
  if (!table) return;

  const rows = table.querySelectorAll("tbody tr");
  if (!rows || rows.length === 0) return;

  const latestRow = rows[0];

  function inspectAndSync() {
    const cols = latestRow.querySelectorAll("td");
    if (!cols || cols.length < 5) return false;

    const subIdLink = cols[0].querySelector("a") || cols[cols.length - 1].querySelector("a");
    const latestSubId = subIdLink ? subIdLink.href.split("/").pop() : "";

    const statusBadge = latestRow.querySelector(".label") || latestRow.querySelector("td.submission-score") || cols[4] || cols[5];
    let rawVerdict = statusBadge ? statusBadge.innerText.trim() : "";

    const vLower = rawVerdict.toLowerCase();

    if (
      !rawVerdict ||
      vLower.includes("wj") ||
      vLower.includes("/") ||
      vLower.includes("compiling") ||
      vLower.includes("judging")
    ) {
      return false;
    }

    let targetProblemName = cols[1]?.innerText.trim().replace(/\s+/g, " ") || "";

    const extractedSubmissions = [];

    rows.forEach((row) => {
      const rCols = row.querySelectorAll("td");
      if (rCols.length >= 5) {
        const pName = rCols[1]?.innerText.trim().replace(/\s+/g, " ") || "";
        const rBadge = row.querySelector(".label") || row.querySelector("td.submission-score") || rCols[4] || rCols[5];
        let rVerdict = rBadge ? rBadge.innerText.trim() : "";
        const rVLower = rVerdict.toLowerCase();

        const rowIdLink = rCols[0].querySelector("a") || rCols[rCols.length - 1].querySelector("a");
        const rowSubId = rowIdLink ? rowIdLink.href.split("/").pop() : "";

        if (
          pName === targetProblemName &&
          rVerdict &&
          !rVLower.includes("wj") &&
          !rVLower.includes("/") &&
          !rVLower.includes("judging")
        ) {
          const timeText = rCols[rCols.length - 2]?.innerText.trim() || "0 ms";
          const memoryText = rCols[rCols.length - 1]?.innerText.trim() || "0 KB";

          extractedSubmissions.push({
            submissionId: rowSubId,
            when: rCols[0]?.innerText.trim() || "",
            language: rCols[3]?.innerText.trim() || "",
            verdict: rVerdict,
            time: timeText.includes("ms") ? timeText : "0 ms",
            memory: memoryText.includes("B") ? memoryText : "0 KB"
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

      const currentSubRecord = extractedSubmissions.find((s) => s.submissionId === latestSubId) || extractedSubmissions[extractedSubmissions.length - 1];

      let contestName = problem.contestName || "";
      if (!contestName) {
        const match = window.location.pathname.match(/\/contests\/([^/]+)/i);
        if (match) contestName = match[1].toUpperCase();
      }

      const fullRecord = {
        platform: "AtCoder",
        submissionId: latestSubId,
        contestName: contestName,
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
    showUISuccess("Successfully synced AtCoder submission to GitHub!");
  }
});

trackVerdictCompletion();