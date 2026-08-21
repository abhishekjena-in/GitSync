// src/utils/uiToast.js

const SUPPORT_EMAIL = "abhishekjena343@gmail.com";

function getOrCreateToastContainer() {
  let container = document.getElementById("cp-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "cp-toast-container";
    container.className = "cp-toast-container";
    
    // Inline fallback styles in case CSS isn't loaded yet
    container.style.position = "fixed";
    container.style.bottom = "24px";
    container.style.right = "24px";
    container.style.zIndex = "2147483647"; // Max browser z-index
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "10px";
    container.style.pointerEvents = "none";

    const parent = document.body || document.documentElement;
    if (parent) {
      parent.appendChild(container);
    }
  }
  return container;
}

function showCPToast(message, type, duration) {
  if (type === undefined) type = "info";
  if (duration === undefined) duration = 4500;

  const container = getOrCreateToastContainer();
  if (!container) return;

  // Clear previous active toast
  const existingToast = document.getElementById("cp-active-toast");
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement("div");
  toast.id = "cp-active-toast";
  toast.className = "cp-sync-toast " + type;

  // Base inline styles for bulletproof rendering on SPAs
  toast.style.pointerEvents = "auto";
  toast.style.minWidth = "300px";
  toast.style.maxWidth = "440px";
  toast.style.padding = "14px 18px";
  toast.style.borderRadius = "8px";
  toast.style.fontSize = "13.5px";
  toast.style.fontWeight = "500";
  toast.style.lineHeight = "1.45";
  toast.style.boxShadow = "0 10px 25px rgba(0, 0, 0, 0.35)";
  toast.style.display = "flex";
  toast.style.alignItems = "center";
  toast.style.gap = "12px";
  toast.style.fontFamily = "system-ui, -apple-system, sans-serif";
  toast.style.transition = "all 0.3s ease";

  let icon = "ℹ️";
  if (type === "success") {
    icon = "✅";
    toast.style.background = "#064e3b";
    toast.style.color = "#34d399";
    toast.style.border = "1px solid #059669";
  } else if (type === "warning") {
    icon = "⚠️";
    toast.style.background = "#451a03";
    toast.style.color = "#fbbf24";
    toast.style.border = "1px solid #d97706";
  } else if (type === "error") {
    icon = "❌";
    toast.style.background = "#450a0a";
    toast.style.color = "#f87171";
    toast.style.border = "1px solid #dc2626";
  } else {
    icon = "⏳";
    toast.style.background = "#0f172a";
    toast.style.color = "#38bdf8";
    toast.style.border = "1px solid #0284c7";
  }

  toast.innerHTML = `
    <span style="font-size: 18px; flex-shrink: 0;">${icon}</span>
    <span style="flex-grow: 1;">${message}</span>
    <span class="cp-toast-close" style="cursor: pointer; font-size: 18px; opacity: 0.7; padding-left: 6px;">&times;</span>
  `;

  const closeBtn = toast.querySelector(".cp-toast-close");
  if (closeBtn) {
    closeBtn.onclick = () => toast.remove();
  }

  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(10px)";
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }
}

function notifyDOMChanged(platformName, missingElementDescription) {
  const msg = `[${platformName}] UI changed on "${missingElementDescription}". Extension update needed! Kindly report to: ${SUPPORT_EMAIL}`;
  showCPToast(msg, "warning", 9000);
  console.warn("[CP-GitSync Diagnostics] " + msg);
}

// Background lifecycle listener (clean text without duplicate emoji icons)
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "SYNC_START") {
      showCPToast(`Syncing [${msg.platform || "Code"}] to GitHub...`, "info", 0);
    } else if (msg.action === "SYNC_SUCCESS") {
      showCPToast(`Successfully synced [${msg.platform || "Code"}] attempt to GitHub!`, "success", 4500);
    } else if (msg.action === "SYNC_ERROR") {
      showCPToast(`GitHub Sync Failed: ${msg.error || "Network/Auth Error"}`, "error", 7000);
    }
  });
}