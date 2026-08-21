// src/core/githubEngine.js

function getExtension(langStr) {
  if (!langStr) return "txt";
  const l = String(langStr).trim().toLowerCase();

  if (l.includes("c++") || l.includes("cpp") || l.includes("g++") || l.includes("gcc")) return "cpp";
  if (l === "c" || l.startsWith("c ") || l.includes("clang")) return "c";
  if (l.includes("java") && !l.includes("javascript")) return "java";
  if (l.includes("python") || l.includes("pypy") || l.startsWith("pyth")) return "py";
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
  if (l.includes("sql") || l.includes("sqlite")) return "sql";
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

  if (
    v === "AC" ||
    v.includes("ACCEPTED") ||
    v.includes("100") ||
    v.includes("OK") ||
    v.includes("CORRECT") ||
    v.includes("PERFECT") ||
    v.includes("PASSED")
  ) {
    return "AC";
  }
  if (v === "TLE" || v.includes("TIME LIMIT")) return "TLE";
  if (v === "MLE" || v.includes("MEMORY LIMIT")) return "MLE";
  if (v === "RE" || v === "RTE" || v.includes("RUNTIME")) return "RTE";
  if (v === "CE" || v.includes("COMPILATION") || v.includes("COMPILE") || v.includes("SYNTAX")) return "CE";

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

function utf8ToBase64(str) {
  return btoa(encodeURIComponent(str || "").replace(/%([0-9A-F]{2})/g, (match, p1) => {
    return String.fromCharCode("0x" + p1);
  }));
}

function cleanRepoName(rawRepo) {
  if (!rawRepo) return "";
  return rawRepo
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
}

// Clean corrupted nested link strings
function extractCleanFileName(rawCellStr) {
  if (!rawCellStr) return "";
  
  // Extract content inside [`...`]
  const bracketMatch = rawCellStr.match(/\[`?([^`\]]+)`?\]/);
  let cleanName = bracketMatch ? bracketMatch[1] : rawCellStr;

  // Remove any relative path prefix
  cleanName = cleanName.replace(/^\.?\/+/, "");

  // If corrupted with chained repeats (e.g., file.java./file.java), isolate the first file token
  if (cleanName.includes("./")) {
    cleanName = cleanName.split("./")[0];
  }

  return cleanName.trim();
}

export async function processGitHubSync(data) {
  const config = await chrome.storage.sync.get(["githubPat", "githubRepo", "githubBranch"]);
  if (!config.githubPat || !config.githubRepo) {
    throw new Error("GitHub PAT or Repository missing in settings.");
  }

  const token = config.githubPat.trim();
  const repo = cleanRepoName(config.githubRepo);
  const branch = (config.githubBranch || "main").trim();

  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache"
  };

  const cleanTitle = sanitizeTitle(data.problemName);
  const platform = data.platform || "Codeforces";

  let folderPath = `${platform}/${cleanTitle}`;
  if (platform.toLowerCase() === "hackerrank" && data.urlSubpath) {
    folderPath = `HackerRank/${data.urlSubpath}`;
  } else if (platform.toLowerCase() === "codechef" && data.urlSubpath) {
    folderPath = `CodeChef/${data.urlSubpath}`;
  } else if (platform.toLowerCase() === "geeksforgeeks" && data.urlSubpath) {
    folderPath = `GeeksforGeeks/${data.urlSubpath}`;
  } else if (platform.toLowerCase() === "codekata" && data.urlSubpath) {
    folderPath = `CodeKata/${data.urlSubpath}`;
  } else if (platform.toLowerCase() === "atcoder" && data.contestName) {
    const cleanContest = sanitizeTitle(data.contestName);
    folderPath = `${platform}/${cleanContest}/${cleanTitle}`;
  }

  const submissionId = data.submissionId;
  const ext = getExtension(data.language);
  const verdictAbbr = getVerdictAbbr(data.verdict);

  // 1. Calculate next attempt number strictly from repo files
  let maxExistingAttempt = 0;
  try {
    const cacheBuster = Date.now();
    const dirRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${folderPath}?ref=${branch}&t=${cacheBuster}`,
      { headers }
    );
    if (dirRes.ok) {
      const files = await dirRes.json();
      if (Array.isArray(files)) {
        files.forEach((f) => {
          const m = f.name.match(/_Attempt_(\d+)_/i);
          if (m) {
            const num = parseInt(m[1], 10);
            if (num < 1000000 && num > maxExistingAttempt) {
              maxExistingAttempt = num;
            }
          }
        });
      }
    }
  } catch (e) {
    console.warn("Could not inspect existing folder attempts:", e);
  }

  const finalAttemptNumber = Math.max(maxExistingAttempt + 1, data.attemptNumber || 1);
  const fileName = `${submissionId}_Attempt_${finalAttemptNumber}_${verdictAbbr}.${ext}`;
  const filePath = `${folderPath}/${fileName}`;

  // 2. Push Code Attempt File
  const encodedCode = utf8ToBase64(data.sourceCode || "");
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
    const errData = await pushRes.json().catch(() => ({ message: pushRes.statusText }));
    throw new Error(errData.message || "Failed to push file to GitHub");
  }

  data.latestAttemptInject = {
    filename: fileName,
    attemptNumber: finalAttemptNumber,
    submissionId: submissionId,
    when: data.when || new Date().toLocaleString(),
    verdict: data.verdict,
    verdictAbbr: verdictAbbr,
    time: data.time || "0 ms",
    memory: data.memory || "0 KB",
    language: data.language,
    ext: ext
  };

  // 3. Re-render Problem README cleanly
  try {
    await syncProblemReadme(headers, repo, branch, folderPath, cleanTitle, platform, data);
  } catch (err) {
    console.error("Problem README update error:", err);
  }

  // 4. Update Root Dashboard
  try {
    await updateRootReadmeFromRepo(headers, repo, branch);
  } catch (err) {
    console.error("Root README update error:", err);
  }

  return true;
}

async function syncProblemReadme(headers, repo, branch, folderPath, cleanTitle, platform, data) {
  const readmePath = `${folderPath}/README.md`;
  let existingReadme = null;
  const historyMap = new Map();

  // 1. Read existing README table entries and clean any malformed rows
  try {
    const cacheBuster = Date.now();
    const res = await fetch(
      `https://api.github.com/repos/${repo}/contents/${readmePath}?ref=${branch}&t=${cacheBuster}`,
      { headers }
    );
    if (res.ok) {
      existingReadme = await res.json();
      const bytes = Uint8Array.from(atob(existingReadme.content.replace(/\s/g, "")), (c) => c.charCodeAt(0));
      const content = new TextDecoder().decode(bytes);
      const lines = content.split("\n");

      lines.forEach((line) => {
        const parts = line.split("|").map((s) => s.trim());
        if (parts.length >= 8 && !isNaN(parseInt(parts[1], 10))) {
          const attempt = parseInt(parts[1], 10);
          const rawFileCell = parts[parts.length - 2] || "";
          const cleanName = extractCleanFileName(rawFileCell);

          historyMap.set(attempt, {
            attemptNumber: attempt,
            submissionId: parts[2] || "",
            when: parts[3] || "",
            verdict: parts[4] || "",
            time: parts[5] || "0 ms",
            memory: parts[6] || "0 KB",
            language: parts[7] || "",
            filename: cleanName
          });
        }
      });
    }
  } catch (e) {
    // README does not exist yet
  }

  // 2. Merge platform table rows
  if (Array.isArray(data.allProblemSubmissions) && data.allProblemSubmissions.length > 0) {
    data.allProblemSubmissions.forEach((s) => {
      if (!historyMap.has(s.attemptNumber)) {
        const vAbbr = getVerdictAbbr(s.verdict);
        const ext = getExtension(s.language);
        const fName = `${s.submissionId}_Attempt_${s.attemptNumber}_${vAbbr}.${ext}`;
        const isAC = vAbbr === "AC";
        const verdictBadge = isAC ? "✅" : "❌";

        historyMap.set(s.attemptNumber, {
          attemptNumber: s.attemptNumber,
          submissionId: s.submissionId,
          when: s.when,
          verdict: `${verdictBadge} ${s.verdict}`,
          time: s.time || "0 ms",
          memory: s.memory || "0 KB",
          language: s.language,
          filename: fName
        });
      }
    });
  }

  // 3. Inject latest current attempt
  if (data.latestAttemptInject) {
    const inj = data.latestAttemptInject;
    const isAC = inj.verdictAbbr === "AC";
    const verdictBadge = isAC ? "✅" : "❌";

    historyMap.set(inj.attemptNumber, {
      attemptNumber: inj.attemptNumber,
      submissionId: inj.submissionId,
      when: inj.when,
      verdict: `${verdictBadge} ${inj.verdict}`,
      time: inj.time || "0 ms",
      memory: inj.memory || "0 KB",
      language: inj.language,
      filename: inj.filename
    });
  }

  const sortedHistory = Array.from(historyMap.values()).sort((a, b) => a.attemptNumber - b.attemptNumber);

  // 4. Build Clean Markdown Table
  const tableHeader = `| Attempt | Submission ID | Date & Time | Verdict | Runtime | Memory | Language | Solution File |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |`;

  const tableRows = sortedHistory
    .map((s) => {
      const fName = s.filename || `${s.submissionId}_Attempt_${s.attemptNumber}_AC.txt`;
      return `| ${s.attemptNumber} | ${s.submissionId || "N/A"} | ${s.when} | ${s.verdict} | ${s.time || "0 ms"} | ${s.memory || "0 KB"} | ${s.language || "N/A"} | [\`${fName}\`](./${fName}) |`;
    })
    .join("\n");

  const probDetails = data.problemDetails || {};
  const problemUrl = probDetails.url || "#";

  const pName = platform.toLowerCase();
  const isSimpleHeader = pName === "geeksforgeeks" || pName === "leetcode" || pName === "codekata";

  const limitsInfo = (!isSimpleHeader && probDetails.timeLimit && probDetails.timeLimit !== "N/A")
    ? ` | **Time Limit:** \`${probDetails.timeLimit}\` | **Memory Limit:** \`${probDetails.memoryLimit || "N/A"}\``
    : "";

  let inputBlock = "";
  if (probDetails.inputSpec && probDetails.inputSpec.trim()) {
    inputBlock = `---

### 📥 Input Specification
${probDetails.inputSpec.trim()}
`;
  }

  let outputBlock = "";
  if (probDetails.outputSpec && probDetails.outputSpec.trim()) {
    outputBlock = `---

### 📤 Output Specification
${probDetails.outputSpec.trim()}
`;
  }

  let sampleBlock = "";
  if (probDetails.sampleTests && probDetails.sampleTests.length > 0) {
    sampleBlock = `---

### 🧪 Sample Tests
` + probDetails.sampleTests
      .map(
        (t, i) => `
#### Example ${i + 1}
**Input:**
\`\`\`text
${t.input}
\`\`\`

**Output:**
\`\`\`text
${t.output}
\`\`\`
`
      )
      .join("\n");
  }

  let noteBlock = "";
  if (probDetails.note && probDetails.note.trim()) {
    noteBlock = `---

### 💡 Note
${probDetails.note.trim()}
`;
  }

  const readmeContent = `# [${cleanTitle}](${problemUrl})

> **Platform:** \`${platform}\`${limitsInfo}  
> **Direct Link:** [Open Problem Statement](${problemUrl})

---

### 📖 Problem Statement
${probDetails.statementParagraphs || "No statement captured."}

${inputBlock}
${outputBlock}
${sampleBlock}
${noteBlock}
---

### 📊 Submission History
${tableHeader}
${tableRows}
`;

  const encodedReadme = utf8ToBase64(readmeContent);

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
    // Root README doesn't exist yet
  }

  const encodedRoot = utf8ToBase64(rootReadmeContent);

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