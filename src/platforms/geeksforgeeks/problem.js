// src/platforms/geeksforgeeks/problem.js

function sanitizePathSegment(segment) {
  if (!segment) return "";
  return String(segment)
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function getGFGUrlSubpath() {
  let path = window.location.pathname;

  path = path
    .replace(/\?.*$/, "")
    .replace(/\/1\/?$/, "")
    .replace(/\/submit.*$/i, "")
    .replace(/\/status.*$/i, "")
    .replace(/^\/+|\/+$/g, "");

  const segments = path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => sanitizePathSegment(segment));

  return segments.join("/");
}

function parseGFGProblemBody(container) {
  if (!container) return "Refer to problem description on GeeksforGeeks.";

  const contentBlocks = [];
  const children = Array.from(container.children);

  children.forEach((child) => {
    const tagName = child.tagName.toLowerCase();

    // 1. Examples Block (<pre>)
    if (tagName === "pre") {
      const text = child.textContent.trim();
      if (text) {
        contentBlocks.push("```text\n" + text + "\n```");
      }
    } 
    // 2. Paragraphs (<p>)
    else if (tagName === "p") {
      let text = child.textContent.trim();
      if (text) {
        if (text.toLowerCase().startsWith("examples:")) {
          contentBlocks.push("#### Examples:");
        } else if (text.toLowerCase().startsWith("constraints:")) {
          // Format constraints cleanly
          const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
          const formatted = lines.map((line, idx) => {
            if (idx === 0 && line.toLowerCase().startsWith("constraints:")) {
              return `**${line}**`;
            }
            return `- ${line}`;
          }).join("\n");
          contentBlocks.push(formatted);
        } else {
          contentBlocks.push(text);
        }
      }
    } 
    // 3. Fallback for nested elements/divs
    else {
      const text = child.textContent.trim();
      if (text) {
        contentBlocks.push(text);
      }
    }
  });

  return contentBlocks.length > 0
    ? contentBlocks.join("\n\n")
    : container.textContent.trim() || "Refer to problem description on GeeksforGeeks.";
}

function extractGFGProblemDetails() {
  // 1. Title Extraction
  const titleEl =
    document.querySelector(".problems_header_content__title__L2cB2 h3") ||
    document.querySelector(".problems_header_content__title h3") ||
    document.querySelector("[class*='header_content'] h3") ||
    document.querySelector("h1");

  const rawTitle = titleEl ? titleEl.textContent.trim() : document.title.replace("- GeeksforGeeks", "").trim();
  const urlSubpath = getGFGUrlSubpath();

  // 2. Full Problem Content Extraction (Targeting the exact problem content container)
  const statementContainer =
    document.querySelector(".problems_problem_content__Xm_eO") ||
    document.querySelector("[class*='problem_content']") ||
    document.querySelector(".problem-statement");

  const statementText = parseGFGProblemBody(statementContainer);

  const problemData = {
    url: window.location.href.split("?")[0],
    title: rawTitle,
    urlSubpath: urlSubpath,
    statementParagraphs: statementText,
    sampleTests: [],
    note: "",
    updatedAt: new Date().toISOString()
  };

  chrome.storage.local.set({ current_problem: problemData }, () => {
    console.log("[CP-GitSync] Captured complete GFG problem statement for:", rawTitle);
  });

  return true;
}

let attempts = 0;
function pollGFGDetails() {
  const ok = extractGFGProblemDetails();
  if (!ok && attempts < 10) {
    attempts++;
    setTimeout(pollGFGDetails, 1000);
  }
}

pollGFGDetails();