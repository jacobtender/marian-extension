// Injected sidebar that iframes the existing popup.html

let marianHost = null;

function ensureSidebar() {
  marianHost = document.getElementById("marian-sidebar-host");
  if (marianHost) return marianHost;

  marianHost = document.createElement("div");
  marianHost.id = "marian-sidebar-host";
  marianHost.style.cssText = [
    "position: fixed",
    "top: 0",
    "right: 0",
    "height: 100vh",
    "width: 380px",
    "z-index: 2147483647",
    "display: flex",
    "box-shadow: -1px 0 6px rgba(0,0,0,.2)",
    "background: white"
  ].join(";");

  const frame = document.createElement("iframe");
  frame.src = chrome.runtime.getURL("popup.html"); // reuse your popup UI
  frame.style.cssText = "flex:1; border:0; height:100%;";

//   marianHost.appendChild(handle);
  marianHost.appendChild(frame);
  document.documentElement.appendChild(marianHost);
  return marianHost;
}

function toggleSidebar() {
  const el = document.getElementById("marian-sidebar-host");
  if (el) { el.remove(); return; }
  ensureSidebar();
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "MARIAN_TOGGLE_SIDEBAR") {
    toggleSidebar();
  }
});
