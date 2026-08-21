// src/platforms/leetcode/graphql.js

function parseLeetCodeDOMProblemBody() {
  const container =
    document.querySelector(".HTMLContent_html__0OZLp") ||
    document.querySelector("div[data-track-load='description_content']") ||
    document.querySelector("[data-track-load='description_content']") ||
    document.querySelector(".elfjS") ||
    document.querySelector("[class*='question-content']");

  if (!container) return null;

  const contentBlocks = [];
  const children = Array.from(container.children);

  children.forEach((child) => {
    const tagName = child.tagName.toLowerCase();

    // 1. Example Blocks (<pre>)
    if (tagName === "pre") {
      const text = child.textContent.trim();
      if (text) {
        contentBlocks.push("```text\n" + text + "\n```");
      }
    }
    // 2. Constraints & Unordered Lists (<ul><li>...</li></ul>)
    else if (tagName === "ul" || tagName === "ol") {
      const lis = Array.from(child.querySelectorAll("li"));
      const items = lis
        .map((li) => `- ${li.textContent.trim()}`)
        .filter((t) => t.length > 2);
      if (items.length > 0) {
        contentBlocks.push(items.join("\n"));
      }
    }
    // 3. Paragraphs (<p>)
    else if (tagName === "p") {
      const text = child.textContent.trim();
      if (!text || text === "\u00A0") return;

      if (text.toLowerCase().startsWith("example")) {
        contentBlocks.push(`#### ${text}`);
      } else if (text.toLowerCase().startsWith("constraints:")) {
        contentBlocks.push("**Constraints:**");
      } else {
        contentBlocks.push(text);
      }
    }
    // 4. Follow-up & other direct text blocks
    else {
      const text = child.textContent.trim();
      if (text && text !== "\u00A0") {
        contentBlocks.push(text);
      }
    }
  });

  return contentBlocks.length > 0 ? contentBlocks.join("\n\n") : null;
}

function convertHtmlToMarkdown(htmlString) {
  if (!htmlString) return "";
  return htmlString
    .replace(/<pre>/gi, "\n```text\n")
    .replace(/<\/pre>/gi, "\n```\n")
    .replace(/<code>/gi, "`")
    .replace(/<\/code>/gi, "`")
    .replace(/<strong[^>]*>/gi, "**")
    .replace(/<\/strong>/gi, "**")
    .replace(/<em[^>]*>/gi, "*")
    .replace(/<\/em>/gi, "*")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<p>/gi, "\n\n")
    .replace(/<\/p>/gi, "")
    .replace(/<ul>/gi, "\n")
    .replace(/<\/ul>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]*>/g, "")
    .trim();
}

async function fetchLeetCodeProblemDetails(titleSlug) {
  const query = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionId
        questionFrontendId
        title
        content
        sampleTestCase
      }
    }
  `;

  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { titleSlug } })
  });

  const json = await res.json();
  return json.data?.question;
}

async function fetchLeetCodeSubmissionDetails(submissionId) {
  const query = `
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        id
        code
        statusDisplay
        statusCode
        timestamp
        lang {
          name
          verboseName
        }
      }
    }
  `;

  let details = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { submissionId: parseInt(submissionId, 10) } })
    });

    const json = await res.json();
    details = json.data?.submissionDetails;

    if (details && details.statusDisplay && !details.statusDisplay.toLowerCase().includes("evaluating")) {
      return details;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return details;
}

function normalizeLeetCodeVerdict(statusDisplay, statusCode) {
  if (!statusDisplay && statusCode === 10) return "Accepted";
  if (!statusDisplay) return "Accepted";

  const s = statusDisplay.trim().toLowerCase();

  if (s.includes("accepted") || statusCode === 10) return "Accepted";
  if (s.includes("compile") || s.includes("compilation") || statusCode === 20) return "Compile Error";
  if (s.includes("runtime") || statusCode === 15) return "Runtime Error";
  if (s.includes("time limit") || statusCode === 11) return "Time Limit Exceeded";
  if (s.includes("memory limit") || statusCode === 12) return "Memory Limit Exceeded";
  if (s.includes("wrong answer")) return "Wrong Answer";

  return statusDisplay;
}

async function buildLeetCodePayload(titleSlug, submissionId) {
  const [problem, submission] = await Promise.all([
    fetchLeetCodeProblemDetails(titleSlug),
    fetchLeetCodeSubmissionDetails(submissionId)
  ]);

  if (!problem || !submission) {
    throw new Error("Failed to fetch LeetCode data via GraphQL API.");
  }

  const problemTitle = `${problem.questionFrontendId}. ${problem.title}`;
  const verdict = normalizeLeetCodeVerdict(submission.statusDisplay, submission.statusCode);
  const language = submission.lang.verboseName || submission.lang.name;

  // 1. Check DOM description (available if user is on description tab)
  const domContent = parseLeetCodeDOMProblemBody();

  // 2. Convert GraphQL HTML content if DOM is hidden/unmounted
  const graphqlMarkdown = convertHtmlToMarkdown(problem.content);

  // 3. Select the best available content
  const statementMarkdown = domContent || graphqlMarkdown;

  // Only warn if neither DOM nor GraphQL returned problem statement data
  if (!statementMarkdown && typeof notifyDOMChanged === "function") {
    notifyDOMChanged("LeetCode", "Problem Description (DOM & GraphQL API)");
  }

  return {
    platform: "LeetCode",
    problemName: problemTitle,
    submissionId: String(submission.id),
    language: language,
    verdict: verdict,
    sourceCode: submission.code,
    timestamp: submission.timestamp
      ? new Date(submission.timestamp * 1000).toLocaleString()
      : new Date().toLocaleString(),

    problemDetails: {
      url: `https://leetcode.com/problems/${titleSlug}/`,
      statementParagraphs: statementMarkdown,
      sampleTests: [],
      note: ""
    }
  };
}