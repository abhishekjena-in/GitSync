function getFullProblemTitle() {
  const problemContainer = document.querySelector(".problem-statement");
  if (!problemContainer) return "";

  const titleEl = problemContainer.querySelector(".title");
  let rawTitle = titleEl ? titleEl.innerText.trim() : "";

  // Remove leading single letters like "A. ", "B. " if present to avoid duplication
  rawTitle = rawTitle.replace(/^[A-Z1-9]\.\s*/, "");

  // Try extracting contest ID and index from URL
  // Example 1: /problemset/problem/158/A
  // Example 2: /contest/158/problem/A
  const urlMatch = window.location.pathname.match(/(?:problem\/|contest\/)(\d+)\/(?:problem\/)?([A-Z\d]+)/i);

  if (urlMatch) {
    const contestId = urlMatch[1];
    const problemIndex = urlMatch[2].toUpperCase();
    return `${contestId}${problemIndex} - ${rawTitle}`;
  }

  return rawTitle;
}

function extractAndSaveProblemDetails() {
  const problemContainer = document.querySelector(".problem-statement");
  if (!problemContainer) return;

  const fullTitle = getFullProblemTitle();

  const timeLimitEl = problemContainer.querySelector(".time-limit");
  const memoryLimitEl = problemContainer.querySelector(".memory-limit");

  const header = problemContainer.querySelector(".header");
  const clones = Array.from(problemContainer.children).filter(
    (child) =>
      child !== header &&
      !child.classList.contains("input-specification") &&
      !child.classList.contains("output-specification") &&
      !child.classList.contains("sample-tests") &&
      !child.classList.contains("note")
  );

  const statementParagraphs = clones.map((c) => c.innerText.trim()).join("\n\n");

  const inputSpec = problemContainer.querySelector(".input-specification")?.innerText.trim() || "";
  const outputSpec = problemContainer.querySelector(".output-specification")?.innerText.trim() || "";
  const note = problemContainer.querySelector(".note")?.innerText.trim() || "";

  const sampleTests = [];
  const inputs = problemContainer.querySelectorAll(".sample-test .input pre");
  const outputs = problemContainer.querySelectorAll(".sample-test .output pre");

  for (let i = 0; i < inputs.length; i++) {
    sampleTests.push({
      input: inputs[i]?.innerText.trim() || "",
      output: outputs[i]?.innerText.trim() || ""
    });
  }

  const problemData = {
    url: window.location.href,
    title: fullTitle,
    timeLimit: timeLimitEl ? timeLimitEl.innerText.replace("time limit per test", "").trim() : "1 second",
    memoryLimit: memoryLimitEl ? memoryLimitEl.innerText.replace("memory limit per test", "").trim() : "256 megabytes",
    statementParagraphs,
    inputSpec,
    outputSpec,
    sampleTests,
    note,
    updatedAt: new Date().toISOString()
  };

  chrome.storage.local.set({ current_problem: problemData }, () => {
    console.log("[CP-GitSync] Captured problem details for:", fullTitle);
  });
}

extractAndSaveProblemDetails();