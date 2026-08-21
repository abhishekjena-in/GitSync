// popup/popup.js

document.addEventListener("DOMContentLoaded", () => {
  const patInput = document.getElementById("githubPat");
  const repoInput = document.getElementById("githubRepo");
  const branchInput = document.getElementById("githubBranch");
  const gistInput = document.getElementById("gistId");
  const saveBtn = document.getElementById("saveConfigBtn");
  const statusMsg = document.getElementById("statusMsg");

  // Load stored credentials
  chrome.storage.sync.get(["githubPat", "githubRepo", "githubBranch", "gistId"], (res) => {
    if (res.githubPat) patInput.value = res.githubPat;
    if (res.githubRepo) repoInput.value = res.githubRepo;
    if (res.githubBranch) branchInput.value = res.githubBranch || "main";
    if (res.gistId) gistInput.value = res.gistId;
  });

  saveBtn.addEventListener("click", async () => {
    const pat = patInput.value.trim();
    let repo = repoInput.value.trim();
    const branch = branchInput.value.trim() || "main";
    let gistId = gistInput.value.trim();

    // Clean URL prefixes if user pasted full repo URL
    repo = repo.replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").trim().replace(/^\/+|\/+$/g, "");

    if (!pat || !repo) {
      statusMsg.className = "status-msg error";
      statusMsg.innerText = "Please fill in PAT and Repository Name.";
      return;
    }

    statusMsg.className = "status-msg";
    statusMsg.innerText = "Validating GitHub permissions...";

    try {
      const headers = { 
        "Authorization": `Bearer ${pat}`, 
        "Accept": "application/vnd.github.v3+json" 
      };

      // 1. Verify User Token
      const userRes = await fetch("https://api.github.com/user", { headers });
      if (!userRes.ok) throw new Error("Invalid PAT. Please check permissions.");
      const userData = await userRes.json();

      // 2. Verify Repository Access
      const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
      if (!repoRes.ok) throw new Error(`Repository '${repo}' not found or inaccessible.`);

      // 3. Auto-Create Secret Gist if Gist ID field is left empty
      if (!gistId) {
        statusMsg.innerText = "Creating private Secret Gist for stats...";
        const initialStats = {
          totalUniqueSolved: 0,
          totalSubmissions: 0,
          platforms: {
            "CodeKata": { solved: [], attempts: 0 },
            "GeeksforGeeks": { solved: [], attempts: 0 },
            "LeetCode": { solved: [], attempts: 0 },
            "Codeforces": { solved: [], attempts: 0 },
            "CodeChef": { solved: [], attempts: 0 },
            "HackerRank": { solved: [], attempts: 0 },
            "HackerEarth": { solved: [], attempts: 0 },
            "AtCoder": { solved: [], attempts: 0 },
            "SPOJ": { solved: [], attempts: 0 },
            "AlgoZenith": { solved: [], attempts: 0 }
          }
        };

        const gistRes = await fetch("https://api.github.com/gists", {
          method: "POST",
          headers,
          body: JSON.stringify({
            description: "CP-GitSync Private Statistics Database",
            public: false,
            files: {
              "cp_sync_stats.json": { content: JSON.stringify(initialStats, null, 2) }
            }
          })
        });

        if (!gistRes.ok) {
          throw new Error("Failed to create Gist. Ensure PAT has the 'gist' scope checked.");
        }

        const newGist = await gistRes.json();
        gistId = newGist.id;
        gistInput.value = gistId;
      }

      // Save credentials locally in Chrome storage
      chrome.storage.sync.set({ githubPat: pat, githubRepo: repo, githubBranch: branch, gistId: gistId }, () => {
        statusMsg.className = "status-msg success";
        statusMsg.innerText = `Authorized as @${userData.login}!\nGist ID: ${gistId.substring(0, 8)}...`;
      });

    } catch (err) {
      statusMsg.className = "status-msg error";
      statusMsg.innerText = err.message;
    }
  });
});