// src/platforms/codechef/problem.js

function sanitizePathSegment(segment) {
  if (!segment) return "";
  return String(segment)
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function getCodeChefUrlSubpath() {
  let path = window.location.pathname;

  path = path
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/submit.*$/i, "")
    .replace(/\/status.*$/i, "");

  const segments = path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => sanitizePathSegment(segment));

  return segments.join("/");
}

function extractAndSaveCodeChefProblemDetails() {
  const container = document.querySelector("._problemStatementWrapper_bh3c4_33") ||
                    document.querySelector("._problemBodyContent_bh3c4_71") ||
                    document.getElementById("problem-statement");

  if (!container) return;

  // 1. EXTRACT TITLE (First h3 inside wrapper, excluding "Sample")
  let title = "";
  const h3s = container.querySelectorAll("h3");
  for (const h3 of h3s) {
    const text = h3.textContent.trim();
    if (text && !text.toLowerCase().includes("sample")) {
      title = text;
      break;
    }
  }

  if (!title) {
    title = document.title.replace("- CodeChef", "").replace("Practice Problem in Java", "").trim();
  }

  // 2. EXTRACT PROBLEM STATEMENT PARAGRAPHS
  // Target paragraphs directly inside _problemBodyContent_bh3c4_71
  const bodyContent = container.querySelector("._problemBodyContent_bh3c4_71") || container;
  const pElements = bodyContent.querySelectorAll("p");
  
  const paragraphs = [];
  pElements.forEach((p) => {
    const txt = p.textContent.trim();
    // Exclude empty paragraphs or sample table child tags
    if (txt && !p.closest("._input_output__table_bh3c4_231")) {
      paragraphs.push(txt);
    }
  });

  const statementText = paragraphs.length > 0
    ? paragraphs.join("\n\n")
    : "Write a program to solve the problem as described on CodeChef.";

  // 3. EXTRACT SAMPLE TEST CASES FROM _input_output__table
  const sampleTests = [];
  const tables = container.querySelectorAll("._input_output__table_bh3c4_231, [class*='input_output__table']");

  tables.forEach((tbl) => {
    const valuesContainer = tbl.querySelector("._values__container_bh3c4_254") || tbl;
    const pres = valuesContainer.querySelectorAll("pre");

    if (pres.length >= 2) {
      let inputVal = pres[0].textContent.trim();
      let outputVal = pres[1].textContent.trim();

      if (!inputVal) inputVal = "N/A (No Input Required)";

      if (outputVal) {
        sampleTests.push({ input: inputVal, output: outputVal });
      }
    } else if (pres.length === 1) {
      const outputVal = pres[0].textContent.trim();
      if (outputVal) {
        sampleTests.push({ input: "N/A (No Input Required)", output: outputVal });
      }
    }
  });

  const urlSubpath = getCodeChefUrlSubpath();

  const problemData = {
    url: window.location.href,
    title: title || "CodeChef Problem",
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
    console.log("[CP-GitSync] Captured CodeChef Details -> Title:", title, "| Samples:", sampleTests.length);
  });
}

// Initial capture with polling retries for SPA rendering
extractAndSaveCodeChefProblemDetails();
setTimeout(extractAndSaveCodeChefProblemDetails, 1000);
setTimeout(extractAndSaveCodeChefProblemDetails, 2500);