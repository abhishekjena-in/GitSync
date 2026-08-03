function showUIWarning(msg) {
  const toast = document.createElement("div");
  toast.className = "cf-sync-toast warning";
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

function injectShowProblemButton() {
  const form = document.querySelector("form.form-horizontal");
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
          <strong>Limits:</strong> ${data.timeLimit || "2 seconds"} | ${data.memoryLimit || "1024 megabytes"}
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
  const form = document.querySelector("form.form-horizontal");
  if (!form) return;

  form.addEventListener("submit", () => {
    try {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
        alert("Extension updated or reloaded. Please refresh the page (F5) before submitting.");
        return;
      }

      // 1. Language Select element on AtCoder
      const languageSelect = document.querySelector("select[name='data.LanguageId']");
      const selectedLanguage = languageSelect ? languageSelect.options[languageSelect.selectedIndex].text : "C++";

      // 2. Extract source code (Standard Textarea / CodeMirror fallback)
      let sourceCode = "";

      // Try reading CodeMirror first (if active on AtCoder)
      const codeMirrorEl = document.querySelector(".CodeMirror");
      if (codeMirrorEl && codeMirrorEl.CodeMirror) {
        sourceCode = codeMirrorEl.CodeMirror.getValue();
      }

      // Fallback: Read plain textarea value
      if (!sourceCode) {
        const plainTextarea = document.querySelector("textarea[name='sourceCode']") ||
                              document.querySelector("textarea.plain-textarea") ||
                              document.querySelector("#plain-textarea");
        sourceCode = plainTextarea ? plainTextarea.value : "";
      }

      const pendingSubmission = {
        language: selectedLanguage,
        sourceCode: sourceCode,
        timestamp: Date.now()
      };

      chrome.storage.local.set({ pending_submission: pendingSubmission }, () => {
        console.log("[CP-GitSync] Captured pending AtCoder submission:", pendingSubmission.language);
      });
    } catch (err) {
      console.error("AtCoder submit parsing error:", err);
      showUIWarning("Error capturing submission. Please check extension console.");
    }
  });
}

injectShowProblemButton();
listenForSubmission();
