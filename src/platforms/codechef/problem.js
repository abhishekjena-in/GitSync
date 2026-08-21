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

function cleanMathAndFormatting(element) {
  if (!element) return "";
  const clone = element.cloneNode(true);

  // 1. Convert KaTeX / MathJax equations
  const katexMath = clone.querySelectorAll(".katex");
  katexMath.forEach((k) => {
    const annotation = k.querySelector("annotation[encoding='application/x-tex']");
    if (annotation && annotation.textContent) {
      k.replaceWith(`$${annotation.textContent.trim()}$`);
    } else {
      k.replaceWith(k.textContent.trim());
    }
  });

  // 2. Format inline elements
  clone.querySelectorAll("b, strong").forEach((el) => {
    const t = el.textContent.trim();
    if (t) el.replaceWith(`**${t}**`);
  });

  clone.querySelectorAll("tt, code").forEach((el) => {
    const t = el.textContent.trim();
    if (t) el.replaceWith(`\`${t}\``);
  });

  clone.querySelectorAll("sub").forEach((el) => {
    const t = el.textContent.trim();
    if (t) el.replaceWith(`_${t}`);
  });

  clone.querySelectorAll("sup").forEach((el) => {
    const t = el.textContent.trim();
    if (t) el.replaceWith(`^${t}`);
  });

  return clone.textContent.trim();
}

function extractAndSaveCodeChefProblemDetails() {
  const contentWrapper =
    document.querySelector("._problemBodyContent_bh3c4_71") ||
    document.getElementById("problem-statement") ||
    document.querySelector("._problemStatementWrapper_bh3c4_33");

  if (!contentWrapper) return;

  // 1. EXTRACT TITLE
  let title = "";
  const h3List = contentWrapper.querySelectorAll("h3");
  for (const h3 of h3List) {
    const text = h3.textContent.trim();
    const lower = text.toLowerCase();
    if (
      text &&
      !lower.includes("sample") &&
      !lower.includes("input") &&
      !lower.includes("output") &&
      !lower.includes("constraint") &&
      !lower.includes("subtask") &&
      !lower.includes("explanation")
    ) {
      title = text;
      break;
    }
  }

  if (!title) {
    title = document.title.replace("- CodeChef", "").replace("Practice Problem in Java", "").trim();
  }

  // 2. EXTRACT SECTIONS ITERATIVELY FROM DOM
  let inputSpec = "";
  let outputSpec = "";
  const statementParts = [];
  const sampleTests = [];

  let currentSection = "statement"; // 'statement' | 'input' | 'output' | 'ignore'

  const children = Array.from(contentWrapper.children);

  children.forEach((child) => {
    const tag = child.tagName.toLowerCase();

    // Check if element is a sample test case table
    if (
      child.classList.contains("_input_output__table_bh3c4_231") ||
      child.querySelector("._values__container_bh3c4_254")
    ) {
      const valuesBox = child.querySelector("._values__container_bh3c4_254") || child;
      const pres = valuesBox.querySelectorAll("pre");

      if (pres.length >= 2) {
        const inVal = pres[0].textContent.trim() || "N/A (No Input Required)";
        const outVal = pres[1].textContent.trim();
        if (outVal) sampleTests.push({ input: inVal, output: outVal });
      } else if (pres.length === 1) {
        const outVal = pres[0].textContent.trim();
        if (outVal) sampleTests.push({ input: "N/A (No Input Required)", output: outVal });
      }
      return;
    }

    // Section Headings
    if (tag === "h3" || tag === "h4") {
      const hText = child.textContent.trim();
      const hLower = hText.toLowerCase();

      if (hLower.includes("sample")) {
        currentSection = "ignore";
        return;
      }
      if (hLower === "input" || hLower.startsWith("input")) {
        currentSection = "input";
        return;
      }
      if (hLower === "output" || hLower.startsWith("output")) {
        currentSection = "output";
        return;
      }
      if (hLower.includes("constraint") || hLower.includes("subtask") || hLower.includes("explanation")) {
        currentSection = "statement";
        statementParts.push(`\n### ${hText}\n`);
        return;
      }
      if (hText === title) {
        return; // Skip repeated title
      }

      currentSection = "statement";
      statementParts.push(`\n### ${hText}\n`);
      return;
    }

    // Unordered / Ordered Lists (e.g. Constraints, Subtasks)
    if (tag === "ul" || tag === "ol") {
      const lis = Array.from(child.querySelectorAll("li"));
      const listMarkdown = lis
        .map((li) => `- ${cleanMathAndFormatting(li)}`)
        .filter((t) => t.length > 2)
        .join("\n");

      if (listMarkdown) {
        if (currentSection === "input") {
          inputSpec += (inputSpec ? "\n\n" : "") + listMarkdown;
        } else if (currentSection === "output") {
          outputSpec += (outputSpec ? "\n\n" : "") + listMarkdown;
        } else if (currentSection === "statement") {
          statementParts.push(listMarkdown);
        }
      }
      return;
    }

    // Paragraphs and Div Text
    if (tag === "p" || tag === "div") {
      const cleaned = cleanMathAndFormatting(child);
      if (!cleaned || cleaned === "\u00A0") return;

      if (currentSection === "input") {
        inputSpec += (inputSpec ? "\n\n" : "") + cleaned;
      } else if (currentSection === "output") {
        outputSpec += (outputSpec ? "\n\n" : "") + cleaned;
      } else if (currentSection === "statement") {
        statementParts.push(cleaned);
      }
    }
  });

  const fullStatement = statementParts.join("\n\n").trim();

  const problemData = {
    url: window.location.href,
    title: title || "CodeChef Problem",
    urlSubpath: getCodeChefUrlSubpath(),
    timeLimit: "N/A",
    memoryLimit: "N/A",
    statementParagraphs: fullStatement || "Write a program to solve the problem as described on CodeChef.",
    inputSpec: inputSpec || "Standard Input",
    outputSpec: outputSpec || "Standard Output",
    sampleTests: sampleTests,
    note: "",
    updatedAt: new Date().toISOString()
  };

  chrome.storage.local.set({ current_problem: problemData });
}

extractAndSaveCodeChefProblemDetails();
setTimeout(extractAndSaveCodeChefProblemDetails, 1000);
setTimeout(extractAndSaveCodeChefProblemDetails, 2500);