// src/platforms/leetcode/graphql.js

function convertHtmlToMarkdown(htmlString) {
  if (!htmlString) return "";
  return htmlString
    .replace(/<pre>/gi, "\n```\n")
    .replace(/<\/pre>/gi, "\n```\n")
    .replace(/<code>/gi, "`")
    .replace(/<\/code>/gi, "`")
    .replace(/<strong[^>]*>/gi, "**")
    .replace(/<\/strong>/gi, "**")
    .replace(/<em[^>]*>/gi, "*")
    .replace(/<\/em>/gi, "*")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<p>/gi, "\n")
    .replace(/<\/p>/gi, "")
    .replace(/<ul>/gi, "\n")
    .replace(/<\/ul>/gi, "\n")
    .replace(/<li>/gi, "* ")
    .replace(/<\/li>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function sanitizeTitle(rawName) {
  const match = rawName.match(/(\d+\s*[A-Z\d]+[\s\S]*)/i);
  let cleaned = match ? match[1] : rawName;
  return cleaned
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
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
    await new Promise(resolve => setTimeout(resolve, 500));
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
  const statementMarkdown = convertHtmlToMarkdown(problem.content);

  return {
    platform: "LeetCode",
    problemName: problemTitle,
    submissionId: String(submission.id),
    language: language,
    verdict: verdict,
    sourceCode: submission.code,
    timestamp: submission.timestamp ? new Date(submission.timestamp * 1000).toLocaleString() : new Date().toLocaleString(),

    problemDetails: {
      url: `https://leetcode.com/problems/${titleSlug}/`,
      timeLimit: "N/A",
      memoryLimit: "N/A",
      statementParagraphs: statementMarkdown,
      inputSpec: "Refer to problem description.",
      outputSpec: "Refer to problem description.",
      sampleTests: problem.sampleTestCase ? [{ input: problem.sampleTestCase, output: "N/A" }] : [],
      note: ""
    }
  };
}
