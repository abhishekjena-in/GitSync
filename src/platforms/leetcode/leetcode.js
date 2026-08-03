// src/platforms/leetcode/leetcode.js

console.log("[CP-GitSync] LeetCode content script loaded.");

observeLeetCodeSubmissions(async ({ titleSlug, submissionId }) => {
  console.log(`[CP-GitSync] Auto-detected submission ${submissionId} for ${titleSlug}`);

  // Guard against invalidated extension context (e.g. extension reloaded while tab stayed open)
  if (!chrome.runtime?.id) {
    console.warn("[CP-GitSync] Extension reloaded. Please refresh this tab to re-initialize sync.");
    return;
  }

  try {
    let payload = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        payload = await buildLeetCodePayload(titleSlug, submissionId);
        if (payload) break;
      } catch (e) {
        console.warn(`[CP-GitSync] GraphQL fetch attempt ${attempt} failed, retrying...`);
        await new Promise(r => setTimeout(r, 1000));
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
  }
});
