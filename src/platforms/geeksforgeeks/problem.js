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

function extractGFGProblemDetails() {
  // 1. Title Extraction
  const titleEl =
    document.querySelector(".problems_header_content__title__L2cB2 h3") ||
    document.querySelector(".problems_header_content__title h3") ||
    document.querySelector("[class*='header_content'] h3") ||
    document.querySelector("h1");

  const rawTitle = titleEl ? titleEl.textContent.trim() : document.title.replace("- GeeksforGeeks", "").trim();
  const urlSubpath = getGFGUrlSubpath();

  // 2. Problem Statement Extraction
  const statementEl = document.querySelector(".problems_problem_content__Xm_eO") ||
                      document.querySelector("[class*='problem_content']");

  let statementText = "";
  if (statementEl) {
    const pNodes = Array.from(statementEl.querySelectorAll("p"));
    const paragraphs = pNodes
      .map((el) => el.textContent.trim())
      .filter((txt) => txt.length > 0 && !txt.toLowerCase().startsWith("examples:"));

    statementText = paragraphs.join("\n\n");
  }

  // 3. Extract Metadata (Difficulty, Accuracy, Points)
  const metaContainer = document.querySelector(".problems_header_description__t_8PB") ||
                        document.querySelector("[class*='header_description']");

  let difficulty = "N/A";
  let accuracy = "N/A";
  let points = "N/A";

  if (metaContainer) {
    const text = metaContainer.textContent;
    const diffMatch = text.match(/Difficulty:\s*([A-Za-z]+)/i);
    const accMatch = text.match(/Accuracy:\s*([\d.%\x2B]+)/i);
    const ptsMatch = text.match(/Points:\s*(\d+)/i);

    if (diffMatch) difficulty = diffMatch[1];
    if (accMatch) accuracy = accMatch[1];
    if (ptsMatch) points = ptsMatch[1];
  }

  // 4. Expected Complexities
  let timeComplexity = "N/A";
  let spaceComplexity = "N/A";
  const complexityTexts = document.querySelectorAll(".problems_normal_text__QiKrb, [class*='normal_text']");

  complexityTexts.forEach((el) => {
    const txt = el.textContent.trim();
    if (txt.toLowerCase().includes("time complexity")) {
      timeComplexity = txt.split(":")[1]?.trim() || txt;
    } else if (txt.toLowerCase().includes("auxiliary space") || txt.toLowerCase().includes("space complexity")) {
      spaceComplexity = txt.split(":")[1]?.trim() || txt;
    }
  });

  // 5. Extract Company & Topic Tags
  const companyTags = [];
  const topicTags = [];

  const tagContainers = document.querySelectorAll(".problems_accordion_tags__JJ2DX, [class*='accordion_tags']");
  tagContainers.forEach((container) => {
    const headerText = container.textContent.toLowerCase();
    const labels = container.querySelectorAll("a.ui.label, [class*='tag_label']");

    if (headerText.includes("company tags")) {
      labels.forEach((lbl) => companyTags.push(lbl.textContent.trim()));
    } else if (headerText.includes("topic tags")) {
      labels.forEach((lbl) => topicTags.push(lbl.textContent.trim()));
    }
  });

  const problemData = {
    url: window.location.href.split("?")[0],
    title: rawTitle,
    urlSubpath: urlSubpath,
    difficulty: difficulty,
    accuracy: accuracy,
    points: points,
    timeLimit: timeComplexity,
    memoryLimit: spaceComplexity,
    companyTags: companyTags,
    topicTags: topicTags,
    statementParagraphs: statementText || "Refer to problem description on GeeksforGeeks.",
    inputSpec: "Standard Input",
    outputSpec: "Standard Output",
    sampleTests: [],
    note: "",
    updatedAt: new Date().toISOString()
  };

  chrome.storage.local.set({ current_problem: problemData }, () => {
    console.log("[CP-GitSync] Captured rich GFG problem details -> Title:", rawTitle, "| Difficulty:", difficulty);
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