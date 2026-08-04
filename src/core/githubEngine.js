// src/core/githubEngine.js

function getExtension(langStr) {
  if (!langStr) return "txt";
  const l = String(langStr).trim().toLowerCase();

  if (l.includes("c++") || l.includes("cpp") || l.includes("g++") || l.includes("gcc")) return "cpp";
  if (l === "c" || l.startsWith("c ") || l.includes("clang")) return "c";
  if (l.includes("java") && !l.includes("javascript")) return "java";
  if (l.includes("python") || l.includes("pypy")) return "py";
  if (l.includes("c#") || l.includes("csharp")) return "cs";
  if (l.includes("javascript") || l.includes("node") || l.includes("js")) return "js";
  if (l.includes("typescript") || l.includes("ts")) return "ts";
  if (l.includes("rust")) return "rs";
  if (l.includes("go") || l.includes("golang")) return "go";
  if (l.includes("kotlin")) return "kt";
  if (l.includes("swift")) return "swift";
  if (l.includes("ruby")) return "rb";
  if (l.includes("php")) return "php";
  if (l.includes("scala")) return "scala";
  if (l.includes("haskell")) return "hs";
  if (l.includes("sql")) return "sql";
  if (l.includes("bash") || l.includes("shell") || l.includes("sh")) return "sh";

  return "txt";
}

function extToLanguageName(ext) {
  const map = {
    cpp: "C++", c: "C", java: "Java", py: "Python", cs: "C#",
    js: "JavaScript", ts: "TypeScript", rs: "Rust", go: "Go",
    kt: "Kotlin", swift: "Swift", rb: "Ruby", php: "PHP",
    scala: "Scala", hs: "Haskell", sql: "SQL", sh: "Bash"
  };
  return map[ext.toLowerCase()] || "Source Code";
}

function getVerdictAbbr(verdict) {
  if (!verdict) return "WA";
  const v = String(verdict).trim().toUpperCase();

  if (v.includes("100") || v === "AC" || v.includes("ACCEPTED") || v.includes("OK")) return "AC";
  if (v === "TLE" || v.includes("TIME LIMIT")) return "TLE";
  if (v === "MLE" || v.includes("MEMORY LIMIT")) return "MLE";
  if (v === "RE" || v === "RTE" || v.includes("RUNTIME")) return "RTE";
  if (v === "CE" || v.includes("COMPILATION") || v.includes("COMPILE")) return "CE";

  return "WA";
}

function abbrToVerdictDisplay(abbr) {
  const map = {
    AC: "✅ Accepted",
    RTE: "❌ Runtime Error",
    CE: "❌ Compile Error",
    TLE: "❌ Time Limit Exceeded",
    MLE: "❌ Memory Limit Exceeded",
    WA: "❌ Wrong Answer"
  };
  return map[abbr.toUpperCase()] || `❌ ${abbr}`;
}

function sanitizeTitle(rawName) {
  if (!rawName) return "Problem";
  return String(rawName)
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export async function processGitHubSync(data) {
  const config = await chrome.storage.sync.get(["githubPat", "githubRepo", "githubBranch"]);
  if (!config.githubPat || !config.githubRepo) {
    console.warn("GitHub credentials missing in popup.");
    return false;
  }

  const { githubPat: token, githubRepo: repo, githubBranch: branch = "main" } = config;
  const headers = {
    "Authorization": `token ${token}`,
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache"
  };

  const cleanTitle = sanitizeTitle(data.problemName);
  const platform = data.platform || "Codeforces";

  // DYNAMIC ROUTING PER PLATFORM
  let folderPath = `${platform}/${cleanTitle}`;

  if (platform.toLowerCase() === "hackerrank" && data.urlSubpath) {
    folderPath = `HackerRank/${data.urlSubpath}`;
  } else if (platform.toLowerCase() === "codechef" && data.urlSubpath) {
    folderPath = `CodeChef/${data.urlSubpath}`;
  } else if (platform.toLowerCase() === "atcoder" && data.contestName) {
    const cleanContest = sanitizeTitle(data.contestName);
    folderPath = `${platform}/${cleanContest}/${cleanTitle}`;
  }

  const submissionId = data.submissionId;
  const ext = getExtension(data.language);
  const verdictAbbr = getVerdictAbbr(data.verdict);

  // 1. Calculate next attempt number dynamically for LeetCode, HackerRank & CodeChef
  let attemptNumber = data.attemptNumber || 1;
  const useFilesystemHistory =
    platform.toLowerCase() === "leetcode" ||
    platform.toLowerCase() === "hackerrank" ||
    platform.toLowerCase() === "codechef";

  if (useFilesystemHistory) {
    try {
      const cacheBuster = Date.now();
      const dirRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/${folderPath}?ref=${branch}&t=${cacheBuster}`,
        { headers }
      );
      if (dirRes.ok) {
        const files = await dirRes.json();
        if (Array.isArray(files)) {
          let maxAttempt = 0;
          files.forEach((f) => {
            const m = f.name.match(/_Attempt_(\d+)_/i);
            if (m) {
              const num = parseInt(m[1], 10);
              if (num < 1000000 && num > maxAttempt) {
                maxAttempt = num;
              }
            }
          });
          attemptNumber = maxAttempt + 1;
        }
      }
    } catch (e) {
      console.warn("Failed to inspect directory for attempt count, using 1:", e);
    }
  }

  const fileName = `${submissionId}_Attempt_${attemptNumber}_${verdictAbbr}.${ext}`;
  const filePath = `${folderPath}/${fileName}`;

  // 2. Push Code Attempt File
  const encodedCode = btoa(unescape(encodeURIComponent(data.sourceCode)));
  const pushRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `[${platform}] ${cleanTitle} - ${data.verdict} (ID: ${submissionId})`,
      content: encodedCode,
      branch: branch
    })
  });

  if (!pushRes.ok) {
    const errorData = await pushRes.json();
    throw new Error(`Failed to push code file: ${errorData.message}`);
  }

  // 3. Re-render Problem-Level README.md
  await syncProblemReadme(
    headers,
    repo,
    branch,
    folderPath,
    cleanTitle,
    platform,
    data,
    data.timestamp || new Date().toLocaleString()
  );

  // 4. Update Root Dashboard
  await updateRootReadmeFromRepo(headers, repo, branch);

  console.log(`Successfully synced attempt ${fileName} and updated Root Dashboard!`);
  return true;
}

async function syncProblemReadme(headers, repo, branch, folderPath, cleanTitle, platform, data, currentTimestamp) {
  const readmePath = `${folderPath}/README.md`;

  let existingReadme = null;
  const existingTimestamps = new Map();

  try {
    const cacheBuster = Date.now();
    const res = await fetch(
      `https://api.github.com/repos/${repo}/contents/${readmePath}?ref=${branch}&t=${cacheBuster}`,
      { headers }
    );
    if (res.ok) {
      existingReadme = await res.json();

      const bytes = Uint8Array.from(atob(existingReadme.content.replace(/\s/g, "")), (c) =>
        c.charCodeAt(0)
      );
      const content = new TextDecoder().decode(bytes);
      const lines = content.split("\n");

      lines.forEach((line) => {
        const parts = line.split("|").map((s) => s.trim());
        if (parts.length >= 6 && !isNaN(parseInt(parts[1], 10))) {
          const attempt = parseInt(parts[1], 10);
          const timeStr = parts[2];
          existingTimestamps.set(attempt, timeStr);
        }
      });
    }
  } catch (e) {
    console.log("README.md does not exist yet.");
  }

  let tableHeader = "";
  let tableRows = "";

  const isFilesystemPlatform =
    platform.toLowerCase() === "leetcode" ||
    platform.toLowerCase() === "hackerrank" ||
    platform.toLowerCase() === "codechef";

  if (isFilesystemPlatform) {
    tableHeader = `| Attempt | Date & Time | Verdict | Language | File |
| :---: | :---: | :---: | :---: | :---: |`;

    try {
      const cacheBuster = Date.now();
      const dirRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/${folderPath}?ref=${branch}&t=${cacheBuster}`,
        { headers }
      );

      if (dirRes.ok) {
        const files = await dirRes.json();
        if (Array.isArray(files)) {
          const attemptFiles = [];

          files.forEach((f) => {
            if (f.name.toLowerCase() !== "readme.md") {
              const match = f.name.match(/_Attempt_(\d+)_([A-Z]+)\.([a-z0-9]+)$/i);
              if (match) {
                const parsedAttempt = parseInt(match[1], 10);
                if (parsedAttempt < 1000000) {
                  attemptFiles.push({
                    filename: f.name,
                    attemptNumber: parsedAttempt,
                    verdictAbbr: match[2],
                    ext: match[3]
                  });
                }
              }
            }
          });

          attemptFiles.sort((a, b) => a.attemptNumber - b.attemptNumber);

          tableRows = attemptFiles
            .map((af) => {
              const verdictDisplay = abbrToVerdictDisplay(af.verdictAbbr);
              const langName = extToLanguageName(af.ext);
              const when = existingTimestamps.get(af.attemptNumber) || currentTimestamp;

              return `| ${af.attemptNumber} | ${when} | ${verdictDisplay} | ${langName} | [\`${af.filename}\`](./${af.filename}) |`;
            })
            .join("\n");
        }
      }
    } catch (e) {
      console.warn(`Failed to read directory files for ${platform} README:`, e);
    }
  } else {
    // --- CODEFORCES, ATCODER, ETC. ---
    tableHeader = `| Attempt | Submission ID | Date & Time | Verdict | Runtime | Memory | Language | File |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |`;

    const submissions = data.allProblemSubmissions || [];
    const sortedSubmissions = [...submissions].sort((a, b) => a.attemptNumber - b.attemptNumber);

    tableRows = sortedSubmissions
      .map((s) => {
        const vAbbr = getVerdictAbbr(s.verdict);
        const ext = getExtension(s.language);
        const fName = `${s.submissionId}_Attempt_${s.attemptNumber}_${vAbbr}.${ext}`;
        const isAC =
          s.verdict.toLowerCase().includes("accepted") || s.verdict.toLowerCase().includes("ok");
        const verdictBadge = isAC ? "✅" : "❌";

        return `| ${s.attemptNumber} | ${s.submissionId} | ${s.when} | ${verdictBadge} ${s.verdict} | ${s.time || "N/A"} | ${s.memory || "N/A"} | ${s.language} | [\`${fName}\`](./${fName}) |`;
      })
      .join("\n");
  }

  const probDetails = data.problemDetails || {};

  const readmeContent = `# [${cleanTitle}]

**Platform:** ${platform}
**Limits:** ${probDetails.timeLimit || "N/A"} | ${probDetails.memoryLimit || "N/A"}
**Link:** [Problem Statement](${probDetails.url || "#"})

---

### 📝 Problem Statement
${probDetails.statementParagraphs || "No statement captured."}

---

### 📥 Input / Output Specification
**Input:** ${probDetails.inputSpec || "Standard Input"}
**Output:** ${probDetails.outputSpec || "Standard Output"}

---

### 🧪 Sample Tests
${
  probDetails.sampleTests && probDetails.sampleTests.length > 0
    ? probDetails.sampleTests
        .map(
          (t, i) => `
#### Example ${i + 1}
**Input:**
\`\`\`
${t.input}
\`\`\`
**Output:**
\`\`\`
${t.output}
\`\`\`
`
        )
        .join("\n")
    : "_No sample test cases provided._"
}

${probDetails.note ? `--- \n### 💡 Note\n${probDetails.note}\n` : ""}

---

### 📊 Submission History
${tableHeader}
${tableRows}
`;

  const encodedReadme = btoa(unescape(encodeURIComponent(readmeContent)));

  await fetch(`https://api.github.com/repos/${repo}/contents/${readmePath}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `[CP-GitSync] Update problem journal for ${cleanTitle}`,
      content: encodedReadme,
      sha: existingReadme ? existingReadme.sha : undefined,
      branch: branch
    })
  });
}

async function updateRootReadmeFromRepo(headers, repo, branch) {
  const platformList = [
    { name: "CodeKata", path: "CodeKata" },
    { name: "GeeksforGeeks", path: "GeeksforGeeks" },
    { name: "LeetCode", path: "LeetCode" },
    { name: "Codeforces", path: "Codeforces" },
    { name: "CodeChef", path: "CodeChef" },
    { name: "HackerRank", path: "HackerRank" },
    { name: "HackerEarth", path: "HackerEarth" },
    { name: "AtCoder", path: "AtCoder" },
    { name: "SPOJ", path: "SPOJ" },
    { name: "AlgoZenith", path: "AlgoZenith" }
  ];

  let grandTotalFiles = 0;
  let grandTotalUniqueSolved = 0;
  const platformStats = {};

  try {
    const cacheBuster = Date.now();
    const treeRes = await fetch(
      `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1&t=${cacheBuster}`,
      { headers }
    );
    if (treeRes.ok) {
      const treeData = await treeRes.json();
      const tree = treeData.tree || [];

      platformList.forEach((p) => {
        const prefix = `${p.path}/`;
        const codeFiles = tree.filter(
          (item) =>
            item.type === "blob" &&
            item.path.startsWith(prefix) &&
            !item.path.endsWith("README.md")
        );

        const totalTrackedFiles = codeFiles.length;
        grandTotalFiles += totalTrackedFiles;

        const acProblemFolders = new Set();
        codeFiles.forEach((f) => {
          if (f.path.includes("_AC.")) {
            const parts = f.path.split("/");
            if (parts.length >= 3) {
              const problemFolder = parts.slice(1, -1).join("/");
              acProblemFolders.add(problemFolder);
            }
          }
        });

        const uniqueSolved = acProblemFolders.size;
        grandTotalUniqueSolved += uniqueSolved;

        platformStats[p.name] = {
          solved: uniqueSolved,
          files: totalTrackedFiles
        };
      });
    }
  } catch (e) {
    console.warn("Could not fetch repo tree for Root README update.", e);
  }

  const rootReadmeContent = `# ⚡ Competitive Programming Solutions

Automated syncing across platforms powered by **CP-GitSync**.

## 📊 Performance Summary
- **Total Unique Problems Solved:** ${grandTotalUniqueSolved}
- **Total Code Solution Files Tracked:** ${grandTotalFiles}

### 📁 Platform Directory
| Platform | Folder Path | Unique Solved / Total Files Tracked |
| :--- | :--- | :---: |
${platformList
  .map((p) => {
    const pData = platformStats[p.name] || { solved: 0, files: 0 };
    return `| **${p.name}** | [\`/${p.path}\`](./${p.path}) | ${pData.solved} / ${pData.files} |`;
  })
  .join("\n")}
`;

  const rootPath = "README.md";
  let existingRoot = null;
  try {
    const cacheBuster = Date.now();
    const res = await fetch(
      `https://api.github.com/repos/${repo}/contents/${rootPath}?ref=${branch}&t=${cacheBuster}`,
      { headers }
    );
    if (res.ok) {
      existingRoot = await res.json();
    }
  } catch (e) {
    console.log("Root README.md does not exist yet.");
  }

  const encodedRoot = btoa(unescape(encodeURIComponent(rootReadmeContent)));

  await fetch(`https://api.github.com/repos/${repo}/contents/${rootPath}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: `[CP-GitSync] Update dashboard statistics`,
      content: encodedRoot,
      sha: existingRoot ? existingRoot.sha : undefined,
      branch: branch
    })
  });
}