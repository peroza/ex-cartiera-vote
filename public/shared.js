const stateListeners = new Set();
let currentState = null;
let eventSource = null;

export function onState(listener) {
  stateListeners.add(listener);
  if (currentState) listener(currentState);
  return () => stateListeners.delete(listener);
}

function emitState(state) {
  currentState = state;
  for (const listener of stateListeners) listener(state);
}

export async function fetchState() {
  const res = await fetch("/api/state");
  if (!res.ok) throw new Error("Failed to load state");
  const state = await res.json();
  emitState(state);
  return state;
}

export function connectLive() {
  if (eventSource) return;
  eventSource = new EventSource("/api/events");
  eventSource.addEventListener("state", (event) => {
    emitState(JSON.parse(event.data));
  });
  eventSource.onerror = () => {
    // Browser will retry; also refresh periodically as fallback
  };
}

export function showToast(message) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("show"), 2400);
}

export function roleLabel(roles, id) {
  return roles.find((r) => r.id === id)?.label || id;
}

export function progressPercent(progress) {
  if (!progress?.totalQuota) return 0;
  return Math.min(100, Math.round((progress.voteCount / progress.totalQuota) * 100));
}

export function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export async function adminFetch(url, { pin, method = "GET", body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-admin-pin": pin || "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
