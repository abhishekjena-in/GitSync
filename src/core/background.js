// src/core/background.js

import { processGitHubSync } from './githubEngine.js';

// Sequential Execution Queue to prevent race conditions & SHA conflicts
const syncQueue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || syncQueue.length === 0) return;

  isProcessing = true;
  const { data, sender } = syncQueue.shift();

  try {
    const success = await processGitHubSync(data);
    if (success && sender && sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(sender.tab.id, { action: "SYNC_SUCCESS" }).catch(() => {
        // Safe messaging fallback if tab reloads or closes
      });
    }
  } catch (err) {
    console.error("GitHub Sync Error:", err);
  } finally {
    isProcessing = false;
    processQueue();
  }
}

// Master Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Action 1: Queue GitHub pushes for Codeforces, AtCoder, and LeetCode
  if (message.action === "SYNC_TO_GITHUB") {
    syncQueue.push({ data: message.data, sender });
    processQueue();
    sendResponse({ status: "queued" });
    return true;
  }

  // Action 2: Read-only history fetcher for LeetCode attempt calculations
  if (message.action === "GET_PROBLEM_HISTORY") {
    (async () => {
      try {
        const config = await chrome.storage.sync.get(["githubPat", "githubRepo", "githubBranch"]);
        if (!config.githubPat || !config.githubRepo) {
          sendResponse({ success: false, existingSubmissions: [], attemptNumber: 1 });
          return;
        }

        const { githubPat: token, githubRepo: repo, githubBranch: branch = "main" } = config;
        const folderPath = message.folderPath;
        const cacheBuster = Date.now();

        // 1. Fetch directory contents via background process (Bypasses web page CORS)
        const dirRes = await fetch(`https://api.github.com/repos/${repo}/contents/${folderPath}?ref=${branch}&t=${cacheBuster}`, {
          headers: {
            "Authorization": `token ${token}`,
            "Cache-Control": "no-cache"
          }
        });

        if (!dirRes.ok) {
          sendResponse({ success: true, existingSubmissions: [], attemptNumber: 1 });
          return;
        }

        const dirFiles = await dirRes.json();
        if (!Array.isArray(dirFiles)) {
          sendResponse({ success: true, existingSubmissions: [], attemptNumber: 1 });
          return;
        }

        // Detect highest attempt number from existing files
        let maxAttemptInFiles = 0;
        dirFiles.forEach(file => {
          const match = file.name.match(/_Attempt_(\d+)_/i);
          if (match) {
            const attemptNum = parseInt(match[1], 10);
            if (attemptNum > maxAttemptInFiles) maxAttemptInFiles = attemptNum;
          }
        });

        // 2. Fetch and decode README.md
        const readmeRes = await fetch(`https://api.github.com/repos/${repo}/contents/${folderPath}/README.md?ref=${branch}&t=${cacheBuster}`, {
          headers: {
            "Authorization": `token ${token}`,
            "Cache-Control": "no-cache"
          }
        });

        if (!readmeRes.ok) {
          sendResponse({ success: true, existingSubmissions: [], attemptNumber: maxAttemptInFiles + 1 });
          return;
        }

        const fileData = await readmeRes.json();

        // Safe UTF-8 Base64 Decoding
        const bytes = Uint8Array.from(atob(fileData.content.replace(/\s/g, '')), c => c.charCodeAt(0));
        let content = new TextDecoder().decode(bytes);

        // Decode HTML entities that interfere with table parsing
        content = content
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&');

        const historyMap = new Map();
        const lines = content.split("\n");

        lines.forEach(line => {
          const parts = line.split("|").map(s => s.trim());
          if (parts.length >= 9 && !isNaN(parseInt(parts[1], 10))) {
            const attempt = parseInt(parts[1], 10);
            historyMap.set(attempt, {
              attemptNumber: attempt,
              submissionId: parts[2],
              when: parts[3],
              verdict: parts[4].replace(/[✅❌]\s*/g, "").trim(),
              time: parts[5],
              memory: parts[6],
              language: parts[7]
            });
          }
        });

        const history = Array.from(historyMap.values()).sort((a, b) => a.attemptNumber - b.attemptNumber);
        const maxAttemptInTable = history.length > 0 ? Math.max(...history.map(h => h.attemptNumber)) : 0;
        const nextAttemptNumber = Math.max(maxAttemptInFiles, maxAttemptInTable) + 1;

        sendResponse({ success: true, existingSubmissions: history, attemptNumber: nextAttemptNumber });
      } catch (err) {
        console.error("[CP-GitSync] Background history fetch error:", err);
        sendResponse({ success: false, existingSubmissions: [], attemptNumber: 1 });
      }
    })();
    return true; // Keeps async response channel open
  }
});
