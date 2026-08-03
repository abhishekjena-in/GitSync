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

function extractAndSaveHackerRankProblemDetails() {
  const titleEl =
    document.querySelector(".ui-icon-label-page") ||
    document.querySelector(".page-label") ||
    document.querySelector("h1.hr-problem-title") ||
    document.querySelector("h1") ||
    document.querySelector(".header-title");

  const rawTitle = titleEl ? titleEl.textContent.trim() : document.title;
  const urlSubpath = getHackerRankUrlSubpath();

  const statementEl =
    document.querySelector(".challenge-body-html") ||
    document.querySelector(".problem-statement") ||
    document.querySelector(".challenge-description");

  let statementText = "Refer to problem description on HackerRank.";
  if (statementEl) {
    statementText = Array.from(statementEl.querySelectorAll("p, pre"))
      .map((el) => el.textContent.trim())
      .filter((text) => text.length > 0)
      .join("\n\n");
  }

  // Extract Sample Test Cases from HackerRank challenge page
  const sampleTests = [];
  const challengeBody = document.querySelector(".challenge-body-html");
  if (challengeBody) {
    const preBlocks = Array.from(challengeBody.querySelectorAll("pre"));
    // Typically sample input & output are adjacent pre blocks under Sample Input / Sample Output headers
    for (let i = 0; i < preBlocks.length - 1; i += 2) {
      const inputVal = preBlocks[i].textContent.trim();
      const outputVal = preBlocks[i + 1].textContent.trim();
      if (inputVal && outputVal) {
        sampleTests.push({ input: inputVal, output: outputVal });
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
    inputSpec: "Standard Input",
    outputSpec: "Standard Output",
    sampleTests: sampleTests,
    note: "",
    updatedAt: new Date().toISOString()
  };

  chrome.storage.local.set({ current_problem: problemData }, () => {
    console.log("[CP-GitSync] Captured HackerRank details & sample cases for:", rawTitle);
  });
}

extractAndSaveHackerRankProblemDetails();
setTimeout(extractAndSaveHackerRankProblemDetails, 2000);