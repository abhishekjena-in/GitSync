// src/platforms/atcoder/problem.js

function getAtCoderContestName() {
  const match = window.location.pathname.match(/\/contests\/([^/]+)/i);
  if (match && match[1]) {
    return match[1].toUpperCase();
  }
  return "";
}

function getFullProblemTitle() {
  const titleEl = document.querySelector("#main-container .h2") || document.querySelector("#main-container h2");
  if (!titleEl) return "Problem";

  let rawTitle = titleEl.innerText.trim();

  const urlMatch = window.location.pathname.match(/\/tasks\/[^_]+_([a-z0-9]+)/i);
  if (urlMatch) {
    const taskLetter = urlMatch[1].toUpperCase();
    if (!rawTitle.toUpperCase().startsWith(taskLetter)) {
      rawTitle = `${taskLetter} - ${rawTitle}`;
    }
  }

  return rawTitle;
}

function cleanAtCoderMathText(element) {
  if (!element) return "";
  const clone = element.cloneNode(true);

  // Remove copy buttons
  clone.querySelectorAll(".btn-copy, .div-btn-copy").forEach((b) => b.remove());

  // Replace KaTeX markup with its TeX annotation for clean markdown
  clone.querySelectorAll(".katex").forEach((k) => {
    const annotation = k.querySelector("annotation");
    if (annotation) {
      k.textContent = ` ${annotation.textContent.trim()} `;
    }
  });

  return clone.innerText.trim();
}

function extractAndSaveProblemDetails() {
  const taskStatement = document.getElementById("task-statement");
  if (!taskStatement) return;

  const fullTitle = getFullProblemTitle();
  const contestName = getAtCoderContestName();

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

  // Target the English language section
  const langEn = taskStatement.querySelector(".lang-en") || taskStatement;

  // Capture clean HTML for the modal preview popup
  const cleanEnglishHtml = langEn.innerHTML;

  const sections = Array.from(langEn.querySelectorAll(".part"));
  const statementParts = [];
  let inputSpec = "";
  let outputSpec = "";

  sections.forEach((section) => {
    const h3Text = section.querySelector("h3")?.innerText.trim() || "";
    const cleanText = cleanAtCoderMathText(section.querySelector("section") || section);
    const textWithoutHeading = cleanText.replace(h3Text, "").trim();

    if (h3Text.includes("Problem Statement")) {
      statementParts.push(textWithoutHeading);
    } else if (h3Text.includes("Constraints")) {
      statementParts.push(`**Constraints:**\n${textWithoutHeading}`);
    } else if (h3Text.includes("Input") && !h3Text.includes("Sample")) {
      inputSpec = textWithoutHeading;
    } else if (h3Text.includes("Output") && !h3Text.includes("Sample")) {
      outputSpec = textWithoutHeading;
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
    contestName: contestName,
    timeLimit,
    memoryLimit,
    statementParagraphs,
    englishHtml: cleanEnglishHtml, // Preserved for direct modal rendering
    inputSpec,
    outputSpec,
    sampleTests,
    note: "",
    updatedAt: new Date().toISOString()
  };

  chrome.storage.local.set({ current_problem: problemData }, () => {
    console.log("[CP-GitSync] Captured AtCoder problem details for:", fullTitle, "Contest:", contestName);
  });
}

extractAndSaveProblemDetails();