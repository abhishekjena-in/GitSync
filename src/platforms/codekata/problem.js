// src/platforms/codekata/problem.js

function sanitizePathSegment(segment) {
  if (!segment) return "";
  return String(segment)
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function getCodeKataUrlSubpath() {
  let path = window.location.pathname;
  path = path.replace(/^\/+|\/+$/g, "").replace(/^code-kata\/?/i, "");
  return sanitizePathSegment(path) || "codekata-problem";
}

function extractAndSaveCodeKataProblemDetails() {
  const container = document.querySelector(".question-container") || document.body;
  if (!container) return;

  // 1. Title
  let title = "";
  const titleEl = container.querySelector(".question-container p.font-bold, .font-bold");
  if (titleEl) {
    title = titleEl.textContent.trim().replace(/^\d+\.\s*/, "");
  }
  if (!title) {
    const slug = getCodeKataUrlSubpath();
    title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // 2. Sections
  let statementText = "";
  let inputSpec = "Standard Input";
  let outputSpec = "Standard Output";
  const sampleTests = [];

  const questionsMarked = container.querySelector(".questionsMarked, .codekataQuestion");
  if (questionsMarked) {
    const ps = Array.from(questionsMarked.querySelectorAll("p"));
    let sampleInput = "";
    let sampleOutput = "";

    ps.forEach((p) => {
      const text = p.innerText.trim();
      const lower = text.toLowerCase();

      if (lower.startsWith("problem statement:")) {
        statementText = text.replace(/problem statement:\s*/i, "").trim();
      } else if (lower.startsWith("input description:")) {
        inputSpec = text.replace(/input description:\s*/i, "").trim();
      } else if (lower.startsWith("output description:")) {
        outputSpec = text.replace(/output description:\s*/i, "").trim();
      } else if (lower.startsWith("sample input:")) {
        sampleInput = text.replace(/sample input:\s*/i, "").trim();
      } else if (lower.startsWith("sample output:")) {
        sampleOutput = text.replace(/sample output:\s*/i, "").trim();
      } else if (!statementText) {
        statementText = text;
      }
    });

    if (sampleInput || sampleOutput) {
      sampleTests.push({
        input: sampleInput || "N/A",
        output: sampleOutput || "N/A"
      });
    }
  }

  const problemData = {
    url: window.location.href,
    title: title || "CodeKata Problem",
    urlSubpath: getCodeKataUrlSubpath(),
    timeLimit: "N/A",
    memoryLimit: "N/A",
    statementParagraphs: statementText || "Solve the problem as described on CodeKata.",
    inputSpec: inputSpec,
    outputSpec: outputSpec,
    sampleTests: sampleTests,
    note: "",
    updatedAt: new Date().toISOString()
  };

  chrome.storage.local.set({ current_problem: problemData });
}

extractAndSaveCodeKataProblemDetails();
setTimeout(extractAndSaveCodeKataProblemDetails, 1000);
setTimeout(extractAndSaveCodeKataProblemDetails, 2500);