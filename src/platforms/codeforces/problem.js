// src/platforms/codeforces/problem.js

function getFullProblemTitle() {
  const problemContainer = document.querySelector(".problem-statement");
  if (!problemContainer) return "";

  const titleEl = problemContainer.querySelector(".title");
  let rawTitle = titleEl ? titleEl.innerText.trim() : "";

  rawTitle = rawTitle.replace(/^[A-Z1-9]\.\s*/, "");

  const urlMatch = window.location.pathname.match(/(?:problemset\/problem|contest)\/(\d+)\/(?:problem\/)?([A-Z\d]+)/i);
  if (urlMatch) {
    const contestId = urlMatch[1];
    const problemIndex = urlMatch[2].toUpperCase();
    return `${contestId}${problemIndex} - ${rawTitle}`;
  }

  return rawTitle;
}

function cleanMathText(node) {
  if (!node) return "";
  const clone = node.cloneNode(true);

  // Convert Codeforces math spans into clean markdown italics
  clone.querySelectorAll(".tex-span").forEach((span) => {
    span.textContent = ` *${span.innerText.trim()}* `;
  });

  // Convert monospace elements
  clone.querySelectorAll(".tex-font-style-tt").forEach((tt) => {
    tt.textContent = ` \`${tt.innerText.trim()}\` `;
  });

  return clone.innerText.trim();
}

function extractAndSaveProblemDetails() {
  const problemContainer = document.querySelector(".problem-statement");
  if (!problemContainer) return;

  const fullTitle = getFullProblemTitle();

  const timeLimitEl = problemContainer.querySelector(".time-limit");
  const memoryLimitEl = problemContainer.querySelector(".memory-limit");

  const header = problemContainer.querySelector(".header");
  const storyBlocks = Array.from(problemContainer.children).filter(
    (child) =>
      child !== header &&
      !child.classList.contains("input-specification") &&
      !child.classList.contains("output-specification") &&
      !child.classList.contains("sample-tests") &&
      !child.classList.contains("note")
  );

  const statementParagraphs = storyBlocks
    .map((block) => {
      const pTags = Array.from(block.querySelectorAll("p"));
      if (pTags.length > 0) {
        return pTags.map((p) => cleanMathText(p)).join("\n\n");
      }
      return cleanMathText(block);
    })
    .filter(Boolean)
    .join("\n\n");

  // Extract Input Specification
  const inputEl = problemContainer.querySelector(".input-specification");
  let inputSpec = "";
  if (inputEl) {
    const inputClone = inputEl.cloneNode(true);
    inputClone.querySelector(".section-title")?.remove();
    inputSpec = cleanMathText(inputClone);
  }

  // Extract Output Specification
  const outputEl = problemContainer.querySelector(".output-specification");
  let outputSpec = "";
  if (outputEl) {
    const outputClone = outputEl.cloneNode(true);
    outputClone.querySelector(".section-title")?.remove();
    outputSpec = cleanMathText(outputClone);
  }

  // Extract Note
  const noteEl = problemContainer.querySelector(".note");
  let note = "";
  if (noteEl) {
    const noteClone = noteEl.cloneNode(true);
    noteClone.querySelector(".section-title")?.remove();
    note = cleanMathText(noteClone);
  }

  // Extract Sample Tests
  const sampleTests = [];
  const inputs = problemContainer.querySelectorAll(".sample-test .input pre");
  const outputs = problemContainer.querySelectorAll(".sample-test .output pre");

  for (let i = 0; i < inputs.length; i++) {
    sampleTests.push({
      input: inputs[i]?.innerText.trim() || "",
      output: outputs[i]?.innerText.trim() || ""
    });
  }

  // Store raw HTML clone for the popup modal preview
  const containerClone = problemContainer.cloneNode(true);
  containerClone.querySelectorAll(".input-output-copier, .btn-copy").forEach((b) => b.remove());

  const problemData = {
    url: window.location.href,
    title: fullTitle,
    timeLimit: timeLimitEl ? timeLimitEl.innerText.replace("time limit per test", "").trim() : "1 second",
    memoryLimit: memoryLimitEl ? memoryLimitEl.innerText.replace("memory limit per test", "").trim() : "256 megabytes",
    statementParagraphs,
    exactProblemHtml: containerClone.outerHTML,
    inputSpec,
    outputSpec,
    sampleTests,
    note,
    updatedAt: new Date().toISOString()
  };

  chrome.storage.local.set({ current_problem: problemData }, () => {
    console.log("[CP-GitSync] Captured Codeforces problem details for:", fullTitle);
  });
}

extractAndSaveProblemDetails();