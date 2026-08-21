// src/core/background.js

import { processGitHubSync } from './githubEngine.js';

// Sequential Execution Queue to prevent race conditions & SHA conflicts
const syncQueue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || syncQueue.length === 0) return;

  isProcessing = true;
  const { data, sender } = syncQueue.shift();
  const tabId = sender && sender.tab ? sender.tab.id : null;

  // 1. Notify User: Sync Process Started
  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      action: "SYNC_START",
      platform: data.platform,
      attempt: data.attemptNumber
    }).catch(() => {});
  }

  try {
    // 2. Perform GitHub Push & README Generation
    const success = await processGitHubSync(data);

    if (success && tabId) {
      // 3. Notify User: Sync Succeeded
      chrome.tabs.sendMessage(tabId, {
        action: "SYNC_SUCCESS",
        platform: data.platform
      }).catch(() => {});
    }
  } catch (err) {
    console.error("[CP-GitSync Queue Error]:", err);
    // 4. Notify User: Sync Failed with Reason
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: "SYNC_ERROR",
        platform: data.platform,
        error: err.message || "Push rejected"
      }).catch(() => {});
    }
  } finally {
    isProcessing = false;
    processQueue();
  }
}

// Master Message Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Action 1: Queue GitHub pushes
  if (message.action === "SYNC_TO_GITHUB") {
    syncQueue.push({ data: message.data, sender });
    processQueue();
    sendResponse({ status: "queued" });
    return true;
  }

  // Action 2: Read-only history fetcher for attempt calculations
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
        const cleanRepo = repo.replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").trim().replace(/^\/+|\/+$/g, "");

        // Fetch directory contents
        const dirRes = await fetch(`https://api.github.com/repos/${cleanRepo}/contents/${folderPath}?ref=${branch}&t=${cacheBuster}`, {
          headers: {
            "Authorization": `Bearer ${token.trim()}`,
            "Cache-Control": "no-cache"
          }
        });

        if (!dirRes.ok) {
          sendResponse({ success: true, existingSubmissions: [], attemptNumber: 1 });
          return;
        }

        const dirFiles = await dirRes.json();
        let maxAttemptInFiles = 0;
        if (Array.isArray(dirFiles)) {
          dirFiles.forEach(file => {
            const match = file.name.match(/_Attempt_(\d+)_/i);
            if (match) {
              const attemptNum = parseInt(match[1], 10);
              if (attemptNum > maxAttemptInFiles) maxAttemptInFiles = attemptNum;
            }
          });
        }

        // Fetch and decode README.md
        const readmeRes = await fetch(`https://api.github.com/repos/${cleanRepo}/contents/${folderPath}/README.md?ref=${branch}&t=${cacheBuster}`, {
          headers: {
            "Authorization": `Bearer ${token.trim()}`,
            "Cache-Control": "no-cache"
          }
        });

        if (!readmeRes.ok) {
          sendResponse({ success: true, existingSubmissions: [], attemptNumber: maxAttemptInFiles + 1 });
          return;
        }

        const fileData = await readmeRes.json();
        const bytes = Uint8Array.from(atob(fileData.content.replace(/\s/g, '')), c => c.charCodeAt(0));
        let content = new TextDecoder().decode(bytes);

        content = content
          .replace(/&quot;/g, '"')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&');

        const historyMap = new Map();
        const lines = content.split("\n");

        lines.forEach(line => {
          const parts = line.split("|").map(s => s.trim());
          if (parts.length >= 8 && !isNaN(parseInt(parts[1], 10))) {
            const attempt = parseInt(parts[1], 10);
            historyMap.set(attempt, {
              attemptNumber: attempt,
              submissionId: parts[2] || "",
              when: parts[3] || "",
              verdict: (parts[4] || "").replace(/[✅❌]\s*/g, "").trim(),
              time: parts[5] || "0 ms",
              memory: parts[6] || "0 KB",
              language: parts[7] || ""
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
    return true;
  }
});