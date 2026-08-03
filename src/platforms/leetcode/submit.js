// src/platforms/leetcode/submit.js

function observeLeetCodeSubmissions(onSubmissionDetected) {
  const extractTitleSlug = () => {
    const match = window.location.pathname.match(/\/problems\/([^\/]+)/);
    return match ? match[1] : null;
  };

  // Inject web accessible script into the main world safely
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("src/platforms/leetcode/inject.js");
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);

  const syncedIds = new Set();

  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "LEETCODE_SUBMISSION_DETECTED") {
      const submissionId = event.data.submissionId;
      const titleSlug = extractTitleSlug();

      if (titleSlug && submissionId && !syncedIds.has(submissionId)) {
        syncedIds.add(submissionId);
        console.log(`[CP-GitSync] Intercepted Submission ID: ${submissionId}`);
        onSubmissionDetected({ titleSlug, submissionId });
      }
    }
  });
}
