function showUIWarning(msg) {
  const toast = document.createElement("div");
  toast.className = "cf-sync-toast warning";
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

function showUISuccess(msg) {
  const toast = document.createElement("div");
  toast.className = "cf-sync-toast success";
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function showUIWarning(msg) {
  const toast = document.createElement("div");
  toast.className = "cf-sync-toast warning";
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}
function verifyDOMStructure() {
  const isStatusPage = window.location.href.includes("/status") || window.location.href.includes("/my");
  if (!isStatusPage) return;

  const table = document.querySelector("table.status-frame-datatable");
  if (!table) {
    console.error("[CP-GitSync Diagnostic] Missing status table! Codeforces may have updated class 'status-frame-datatable'.");
    return;
  }

  const firstRow = table.querySelector("tr[data-submission-id]");
  if (!firstRow) {
    console.error("[CP-GitSync Diagnostic] Missing submission rows! Check if attribute 'data-submission-id' was renamed.");
  }
}

// Run diagnostic check on load
verifyDOMStructure();
function injectShowProblemButton() {
  const form = document.querySelector(".submit-form, .submitFrameForm");
  // If no submission form exists on the current page view, exit silently
  if (!form) return;

  if (document.getElementById("cpj-show-problem-btn")) return;

  const btn = document.createElement("button");
  btn.id = "cpj-show-problem-btn";
  btn.type = "button";
  btn.className = "cpj-show-problem-btn";
  btn.innerText = "Show Problem";

  btn.addEventListener("click", renderProblemModal);
  form.parentNode.insertBefore(btn, form);
}

function renderProblemModal() {
  if (document.getElementById("cf-problem-modal")) return;

  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
    alert("Extension updated or reloaded. Please refresh the page (F5) and try again.");
    return;
  }

  chrome.storage.local.get(["current_problem"], (res) => {
    const data = res.current_problem;
    if (!data) {
      alert("No problem details found. Please visit the problem page first.");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "cf-problem-modal";
    modal.className = "cf-problem-modal";

    modal.innerHTML = `
      <div class="cf-modal-header" id="cf-modal-header">
        <span>${data.title}</span>
        <span class="cf-modal-close" id="cf-modal-close">&times;</span>
      </div>
      <div class="cf-modal-body">
        <div class="modal-section">
          <strong>Limits:</strong> ${data.timeLimit || "1 second"} | ${data.memoryLimit || "256 megabytes"}
        </div>

        <div class="modal-section">
          ${data.statementParagraphs ? data.statementParagraphs.replace(/\n\n/g, "<br/><br/>") : ""}
        </div>

        ${data.inputSpec ? `
          <div class="modal-section">
            <h4 class="modal-title">Input Specification</h4>
            <p>${data.inputSpec}</p>
          </div>
        ` : ''}

        ${data.outputSpec ? `
          <div class="modal-section">
            <h4 class="modal-title">Output Specification</h4>
            <p>${data.outputSpec}</p>
          </div>
        ` : ''}

        ${(data.sampleTests && data.sampleTests.length > 0) ? `
          <div class="modal-section">
            <h4 class="modal-title">Examples</h4>
            ${data.sampleTests.map((t, idx) => `
              <div class="sample-box">
                <div><strong>Input ${idx + 1}:</strong></div>
                <pre class="code-block">${t.input}</pre>
                <div><strong>Output ${idx + 1}:</strong></div>
                <pre class="code-block">${t.output}</pre>
              </div>
            `).join("")}
          </div>
        ` : ''}

        ${data.note ? `
          <div class="modal-section">
            <h4 class="modal-title">Note</h4>
            <p>${data.note}</p>
          </div>
        ` : ''}
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById("cf-modal-close").onclick = () => modal.remove();
    makeElementDraggable(modal, document.getElementById("cf-modal-header"));
  });
}

function makeElementDraggable(elmnt, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  handle.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
    elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

function listenForSubmission() {
  const form = document.querySelector(".submit-form, .submitFrameForm");
  // Return quietly if there's no submit form on this view
  if (!form) return;

  form.addEventListener("submit", () => {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        alert("Extension updated or reloaded. Please refresh the page (F5) before submitting.");
        return;
      }

      const languageSelect = document.querySelector("select[name='programTypeId']");
      const selectedLanguage = languageSelect ? languageSelect.options[languageSelect.selectedIndex].text : "Unknown";

      let sourceCode = document.getElementById("sourceCodeTextarea")?.value || "";
      if (!sourceCode && window.ace) {
        const editor = window.ace.edit("editor");
        sourceCode = editor ? editor.getValue() : "";
      }

      const pendingSubmission = {
        language: selectedLanguage,
        sourceCode: sourceCode,
        timestamp: Date.now()
      };

      chrome.storage.local.set({ pending_submission: pendingSubmission });
    } catch (err) {
      console.error("Codeforces submit parsing error:", err);
      showUIWarning("Error capturing submission. Please check extension console.");
    }
  });
}

// Initialize on page load
injectShowProblemButton();
listenForSubmission();


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

      if (history.some(item => item.submissionId === latestSubId)) {
        return;
      }

      const currentSubRecord = extractedSubmissions.find(s => s.submissionId === latestSubId) || extractedSubmissions[extractedSubmissions.length - 1];

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
