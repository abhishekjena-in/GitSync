// src/platforms/leetcode/leetcode.js

// Safe helper using global showCPToast with local fallback
function notifyLeetCode(msg, type = "info") {
  if (typeof showCPToast === "function") {
    showCPToast(msg, type);
  } else {
    // Local fallback in case uiToast.js is still initializing
    const existing = document.querySelectorAll(".cp-sync-toast, .cf-sync-toast");
    existing.forEach((t) => t.remove());

    const toast = document.createElement("div");
    toast.className = `cp-sync-toast ${type}`;

    const iconMap = {
      info: "⏳",
      success: "✅",
      warning: "⚠️",
      error: "❌"
    };

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>${iconMap[type] || "ℹ️"}</span>
        <span>${msg}</span>
      </div>
    `;
    document.body.appendChild(toast);

    if (type !== "info") {
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 400);
      }, 4000);
    }
  }
}

console.log("[CP-GitSync] LeetCode content script loaded.");

observeLeetCodeSubmissions(async ({ titleSlug, submissionId }) => {
  console.log(`[CP-GitSync] Auto-detected submission ${submissionId} for ${titleSlug}`);

  if (!chrome.runtime?.id) {
    notifyLeetCode("Extension reloaded. Please refresh the page.", "error");
    return;
  }

  notifyLeetCode("Syncing submission to GitHub...", "info");

  try {
    let payload = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        payload = await buildLeetCodePayload(titleSlug, submissionId);
        if (payload) break;
      } catch (e) {
        console.warn(`[CP-GitSync] GraphQL fetch attempt ${attempt} failed, retrying...`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    if (!payload) {
      throw new Error("Could not retrieve submission payload after retries.");
    }

    // Dispatch payload to background queue
    chrome.runtime.sendMessage({
      action: "SYNC_TO_GITHUB",
      data: payload
    });

    console.log("[CP-GitSync] Payload sent to background queue!");
  } catch (err) {
    console.error("[CP-GitSync] Failed to process auto-sync:", err);
    notifyLeetCode(`Sync failed: ${err.message}`, "error");
  }
});

// Listener for background success confirmation
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "SYNC_SUCCESS") {
    notifyLeetCode("Successfully synced LeetCode solution to GitHub!", "success");
  }
});