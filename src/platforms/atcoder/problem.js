function getAtCoderContestName() {
  // Extract contest code directly from URL path
  // Example: /contests/abc463/tasks/abc463_a  ->  ABC463
  // Example: /contests/wtf2026/tasks/...     ->  WTF2026
  const match = window.location.pathname.match(/\/contests\/([^/]+)/i);
  if (match && match[1]) {
    return match[1].toUpperCase();
  }
  return "";
}

function getFullProblemTitle() {
  const titleEl = document.querySelector("#main-container .h2") || document.querySelector("#main-container h2");
  if (!titleEl) return "";

  let rawTitle = titleEl.innerText.trim();

  const urlMatch = window.location.pathname.match(/\/contests\/([^/]+)\/tasks\/([^/]+)/i);

  if (urlMatch) {
    const taskId = urlMatch[2];
    const cleanTitle = rawTitle.replace(/^[A-Z0-9]\s*-\s*/, "");
    return `${taskId} - ${cleanTitle}`;
  }

  return rawTitle;
}

function extractAndSaveProblemDetails() {
  const taskStatement = document.getElementById("task-statement");
  if (!taskStatement) return;

  const fullTitle = getFullProblemTitle();
  const contestName = getAtCoderContestName(); // Extract short code (e.g. ABC463)

  let timeLimit = "2 seconds";
  let memoryLimit = "1024 megabytes";

  const pTags = document.querySelectorAll("#main-container p");
  for (const p of pTags) {
    const text = p.innerText;
    if (text.includes("Time Limit") || text.includes("Memory Limit")) {
      const timeMatch = text.match(/Time Limit:\s*([^/]+)/i);
      const memoryMatch = text.match(/Memory Limit:\s*(.+)/i);
      if (timeMatch) timeLimit = timeMatch[1].trim();
      if (memoryMatch) memoryLimit = memoryMatch[1].trim();
      break;
    }
  }

  const langEn = taskStatement.querySelector(".lang-en") || taskStatement;

  const sections = Array.from(langEn.querySelectorAll(".part"));
  const statementParts = [];
  let inputSpec = "";
  let outputSpec = "";

  sections.forEach((section) => {
    const h3Text = section.querySelector("h3")?.innerText.trim() || "";
    const textContent = Array.from(section.querySelectorAll("p"))
      .map((p) => p.innerText.trim())
      .join("\n\n");

    if (h3Text.includes("Problem Statement")) {
      statementParts.push(textContent);
    } else if (h3Text.includes("Constraints")) {
      statementParts.push(`**Constraints:**\n${textContent}`);
    } else if (h3Text.includes("Input")) {
      inputSpec = textContent;
    } else if (h3Text.includes("Output")) {
      outputSpec = textContent;
    }
  });

  const statementParagraphs = statementParts.join("\n\n");

  const sampleTests = [];
  const inputs = {};
  const outputs = {};

  sections.forEach((section) => {
    const h3Text = section.querySelector("h3")?.innerText.trim() || "";
    const preText = section.querySelector("pre")?.innerText.trim() || "";

    const inMatch = h3Text.match(/Sample Input\s*(\d+)/i);
    const outMatch = h3Text.match(/Sample Output\s*(\d+)/i);

    if (inMatch) {
      inputs[inMatch[1]] = preText;
    } else if (outMatch) {
      outputs[outMatch[1]] = preText;
    }
  });

  Object.keys(inputs).forEach((idx) => {
    if (outputs[idx] !== undefined) {
      sampleTests.push({
        input: inputs[idx],
        output: outputs[idx]
      });
    }
  });

  const problemData = {
    url: window.location.href,
    title: fullTitle,
    contestName: contestName, // Added contest short code!
    timeLimit,
    memoryLimit,
    statementParagraphs,
    inputSpec,
    outputSpec,
    sampleTests,
    note: "",
    updatedAt: new Date().toISOString()
  };

  chrome.storage.local.set({ current_problem: problemData }, () => {
    console.log("[CP-GitSync] Captured AtCoder problem details for:", fullTitle, "in contest:", contestName);
  });
}

extractAndSaveProblemDetails();