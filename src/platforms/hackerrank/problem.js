// src/platforms/hackerrank/problem.js

function sanitizePathSegment(segment) {
  if (!segment) return "";
  return String(segment)
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function getHackerRankUrlSubpath() {
  let path = window.location.pathname;

  path = path
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/problem.*$/i, "")
    .replace(/\/submissions.*$/i, "")
    .replace(/\/submit.*$/i, "");

  const segments = path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => sanitizePathSegment(segment));

  return segments.join("/");
}

function getSectionText(parentEl, className) {
  const container = parentEl ? parentEl.querySelector(`.${className}`) : null;
  if (!container) return "";

  // Select all paragraphs, list items, or pre blocks inside the target section
  const nodes = container.querySelectorAll(".hackdown-content p, .hackdown-content li, .hackdown-content pre");
  if (!nodes || nodes.length === 0) return container.textContent.trim();

  return Array.from(nodes)
    .map((node) => {
      const text = node.textContent.trim();
      if (node.tagName.toLowerCase() === "li") return `* ${text}`;
      return text;
    })
    .filter((text) => text.length > 0)
    .join("\n\n");
}

function extractAndSaveHackerRankProblemDetails() {
  const titleEl =
    document.querySelector(".ui-icon-label-page") ||
    document.querySelector(".page-label") ||
    document.querySelector("h1.hr-problem-title") ||
    document.querySelector("h1") ||
    document.querySelector(".header-title");

  const rawTitle = titleEl ? titleEl.textContent.trim() : document.title;
  const urlSubpath = getHackerRankUrlSubpath();

  const challengeBody =
    document.querySelector(".challenge-body-html") ||
    document.querySelector(".problem-statement") ||
    document.querySelector(".challenge-description");

  // 1. Extract Main Problem Statement
  let statementText = getSectionText(challengeBody, "challenge_problem_statement");
  if (!statementText) statementText = "Refer to problem description on HackerRank.";

  // 2. Extract Input Format, Constraints, and Output Format cleanly
  const inputSpec = getSectionText(challengeBody, "challenge_input_format") || "Standard Input";
  const constraintsText = getSectionText(challengeBody, "challenge_constraints");
  const outputSpec = getSectionText(challengeBody, "challenge_output_format") || "Standard Output";

  // 3. Extract Sample Inputs & Outputs
  const sampleTests = [];
  if (challengeBody) {
    const sampleInputBlocks = challengeBody.querySelectorAll(".challenge_sample_input");
    const sampleOutputBlocks = challengeBody.querySelectorAll(".challenge_sample_output");

    const count = Math.min(sampleInputBlocks.length, sampleOutputBlocks.length);
    for (let i = 0; i < count; i++) {
      const inPre = sampleInputBlocks[i].querySelector("pre");
      const outPre = sampleOutputBlocks[i].querySelector("pre");

      const inVal = inPre ? inPre.textContent.trim() : sampleInputBlocks[i].textContent.trim();
      const outVal = outPre ? outPre.textContent.trim() : sampleOutputBlocks[i].textContent.trim();

      if (inVal && outVal) {
        sampleTests.push({ input: inVal, output: outVal });
      }
    }
  }

  const problemData = {
    url: window.location.href,
    title: rawTitle,
    urlSubpath: urlSubpath,
    timeLimit: "N/A",
    memoryLimit: "N/A",
    statementParagraphs: statementText,
    inputSpec: inputSpec,
    outputSpec: outputSpec,
    sampleTests: sampleTests,
    note: constraintsText ? `**Constraints:**\n${constraintsText}` : "",
    updatedAt: new Date().toISOString()
  };

  chrome.storage.local.set({ current_problem: problemData }, () => {
    console.log("[CP-GitSync] Captured pristine HackerRank details for:", rawTitle);
  });
}

extractAndSaveHackerRankProblemDetails();
setTimeout(extractAndSaveHackerRankProblemDetails, 2000);