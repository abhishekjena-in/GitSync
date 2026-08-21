// src/platforms/atcoder/submit.js

function showUIWarning(msg) {
  if (typeof showCPToast === "function") {
    showCPToast(msg, "warning");
  } else {
    const toast = document.createElement("div");
    toast.className = "cf-sync-toast warning";
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  }
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
      alert("No problem details found. Please visit the problem statement page first.");
      return;
    }

    const modal = document.createElement("div");
    modal.id = "cf-problem-modal";
    modal.className = "cf-problem-modal";

    // Direct render of the English task statement with full KaTeX math & styling
    let bodyContent = "";
    if (data.englishHtml) {
      bodyContent = `
        <div class="modal-section" style="margin-bottom: 12px; font-weight: 600; color: #64748b;">
          Limits: ${data.timeLimit || "2 seconds"} | ${data.memoryLimit || "1024 megabytes"}
        </div>
        <div class="atcoder-modal-rendered-content">
          ${data.englishHtml}
        </div>
      `;
    } else {
      bodyContent = `
        <div class="modal-section">
          <strong>Limits:</strong> ${data.timeLimit || "2 seconds"} | ${data.memoryLimit || "1024 megabytes"}
        </div>
        <div class="modal-section">
          ${data.statementParagraphs ? data.statementParagraphs.replace(/\n\n/g, "<br/><br/>") : ""}
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="cf-modal-header" id="cf-modal-header">
        <span>${data.title}</span>
        <span class="cf-modal-close" id="cf-modal-close">&times;</span>
      </div>
      <div class="cf-modal-body">
        ${bodyContent}
      </div>
    `;

    document.body.appendChild(modal);

    // Strip duplicate inline copy buttons inside the modal
    modal.querySelectorAll(".btn-copy, .div-btn-copy").forEach((btn) => btn.remove());

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

      const languageSelect = document.querySelector("select[name='data.LanguageId']");
      const selectedLanguage = languageSelect ? languageSelect.options[languageSelect.selectedIndex].text : "C++";

      let sourceCode = "";

      // Try reading CodeMirror instance first
      const codeMirrorEl = document.querySelector(".CodeMirror");
      if (codeMirrorEl && codeMirrorEl.CodeMirror) {
        sourceCode = codeMirrorEl.CodeMirror.getValue();
      }

      // Fallback to standard textarea
      if (!sourceCode) {
        const plainTextarea =
          document.querySelector("textarea[name='sourceCode']") ||
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