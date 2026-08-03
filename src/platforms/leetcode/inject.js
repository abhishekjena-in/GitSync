// src/platforms/leetcode/inject.js
(function () {
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";

      // Check if network call is a submission or GraphQL endpoint
      if (url.includes("/submit/") || url.includes("/graphql")) {
        const clone = response.clone();
        clone
          .json()
          .then((data) => {
            if (data && data.submission_id) {
              window.postMessage(
                {
                  type: "LEETCODE_SUBMISSION_DETECTED",
                  submissionId: String(data.submission_id),
                },
                "*"
              );
            } else if (
              data &&
              data.data &&
              data.data.submissionDetails &&
              data.data.submissionDetails.id
            ) {
              window.postMessage(
                {
                  type: "LEETCODE_SUBMISSION_DETECTED",
                  submissionId: String(data.data.submissionDetails.id),
                },
                "*"
              );
            }
          })
          .catch(() => {});
      }
    } catch (e) {}

    return response;
  };
})();
