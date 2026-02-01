// Set window.__API_BASE__ before loading (e.g. to ALB URL) or leave default for local backend on :3000
const API_BASE = (typeof window !== "undefined" && window.__API_BASE__) || "http://localhost:3000";

const el = (id) => document.getElementById(id);

const state = {
  token: null,
  user: null,
  socket: null,
  servers: [],
  channels: [],
  serverId: null,
  channelId: null,
  currentChannelName: "general",
  callId: null,
  pc: null,
  localStream: null,
  channelSearch: ""
};

function setHint(id, msg) {
  const node = el(id);
  if (node) node.textContent = msg || "";
}

function setStatus(s) {
  const statusEl = el("userStatus");
  if (statusEl) {
    statusEl.textContent = s === "disconnected" ? "Offline" : "Online";
    statusEl.classList.toggle("online", s !== "disconnected");
  }
  const dotEl = el("userStatusDot");
  if (dotEl) {
    dotEl.classList.toggle("online", s !== "disconnected");
    dotEl.title = s === "disconnected" ? "Offline" : "Online";
  }
}

async function api(path, { method = "GET", body } = {}) {
  const url = `${API_BASE}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    const msg = (e && e.message) || String(e);
    if (msg.toLowerCase().includes("fetch") || e.name === "TypeError") {
      throw new Error("Cannot reach server at " + API_BASE + ". Is the backend running? Check CORS if the page is on a different origin.");
    }
    throw e;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `http_${res.status}`);
  return json;
}

function showScreen(loggedIn) {
  el("loginScreen").classList.toggle("hidden", loggedIn);
  el("app").classList.toggle("hidden", !loggedIn);
  if (loggedIn) {
    el("userName").textContent = state.user?.username || "—";
    el("userAvatar").textContent = (state.user?.username || "?")[0].toUpperCase();
    el("chatInput").placeholder = "Message #" + (state.currentChannelName || "general");
  }
}

function mountSocket() {
  if (state.socket) state.socket.disconnect();
  if (!state.token) return;

  state.socket = io(API_BASE, { auth: { token: state.token } });

  state.socket.on("connect", () => setStatus("connected"));
  state.socket.on("disconnect", () => setStatus("disconnected"));

  state.socket.on("message:new", (msg) => addMessage(msg));

  state.socket.on("call:created", ({ callId }) => {
    state.callId = callId;
    const input = el("callId");
    if (input) input.value = callId;
    setHint("authHint", `Call created. Share the Call ID with another browser to join.`);
  });

  state.socket.on("webrtc:offer", async ({ callId, offer }) => {
    if (callId !== state.callId) return;
    await ensurePeerConnection();
    await state.pc.setRemoteDescription(offer);
    const answer = await state.pc.createAnswer();
    await state.pc.setLocalDescription(answer);
    state.socket.emit("webrtc:answer", { callId, answer });
  });

  state.socket.on("webrtc:answer", async ({ callId, answer }) => {
    if (callId !== state.callId) return;
    if (!state.pc) return;
    await state.pc.setRemoteDescription(answer);
  });

  state.socket.on("webrtc:ice-candidate", async ({ callId, candidate }) => {
    if (callId !== state.callId) return;
    if (!state.pc) return;
    try {
      const c = candidate && typeof candidate === "object" ? new RTCIceCandidate(candidate) : candidate;
      await state.pc.addIceCandidate(c);
    } catch {}
  });

  state.socket.on("call:ended", ({ callId }) => {
    if (callId !== state.callId) return;
    hangup();
    setHint("authHint", "Call ended.");
  });
}

function addMessage(msg) {
  const root = el("messages");
  if (!root) return;
  const row = document.createElement("div");
  row.className = "message-row";
  const initial = (msg.username || "?")[0].toUpperCase();
  const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "";
  row.innerHTML = `
    <div class="message-avatar">${escapeHtml(initial)}</div>
    <div class="message-body">
      <div class="message-header">
        <span class="message-username">${escapeHtml(msg.username)}</span>
        <span class="message-time">${escapeHtml(timeStr)}</span>
      </div>
      <div class="message-content">${escapeHtml(msg.content)}</div>
    </div>
  `;
  root.appendChild(row);
  root.scrollTop = root.scrollHeight;
}

function clearMessages() {
  const root = el("messages");
  if (root) root.innerHTML = "";
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function serverIconColor(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 60%, 50%)`;
}

function renderServerList() {
  const container = el("serverIcons");
  if (!container) return;
  container.innerHTML = "";
  for (const s of state.servers) {
    const btn = document.createElement("button");
    btn.className = "server-icon" + (state.serverId === s.id ? " active" : "");
    btn.style.background = serverIconColor(s.name);
    btn.textContent = (s.name || "?")[0].toUpperCase();
    btn.title = s.name;
    btn.onclick = () => selectServer(s.id);
    container.appendChild(btn);
  }
}

function renderChannelList() {
  const container = el("channelList");
  if (!container) return;
  const q = (state.channelSearch || "").trim().toLowerCase();
  const channels = q ? state.channels.filter((c) => (c.name || "").toLowerCase().includes(q)) : state.channels;
  container.innerHTML = "";
  for (const c of channels) {
    const item = document.createElement("div");
    item.className = "channel-item" + (state.channelId === c.id ? " active" : "");
    item.innerHTML = `<span class="hash">#</span><span>${escapeHtml(c.name)}</span>`;
    item.onclick = () => joinChannel(c.id);
    container.appendChild(item);
  }
}

async function selectServer(serverId) {
  state.serverId = serverId;
  renderServerList();
  const server = state.servers.find((s) => s.id === serverId);
  el("currentServerName").textContent = server ? server.name : "Select a server";
  await refreshChannels();
}

async function refreshServers() {
  const { servers } = await api("/api/servers");
  state.servers = servers || [];
  state.serverId = null;
  state.channelId = null;
  state.channels = [];
  renderServerList();
  renderChannelList();
  el("currentServerName").textContent = "Select a server";
  const nameEl = el("channelNameDisplay");
  if (nameEl) nameEl.textContent = "general";
  state.currentChannelName = "general";
  clearMessages();
  if (state.servers[0]) await selectServer(state.servers[0].id);
}

async function refreshChannels() {
  const serverId = state.serverId;
  if (!serverId) return;
  const { channels } = await api(`/api/servers/${serverId}/channels`);
  state.channels = channels || [];
  state.channelId = null;
  renderChannelList();
  if (state.channels[0]) await joinChannel(state.channels[0].id);
  else {
    clearMessages();
    if (el("channelNameDisplay")) el("channelNameDisplay").textContent = "general";
    state.currentChannelName = "general";
    if (el("chatInput")) el("chatInput").placeholder = "Message #general";
  }
}

async function joinChannel(channelId) {
  if (!channelId) return;
  state.channelId = channelId;
  const ch = state.channels.find((c) => c.id === channelId);
  state.currentChannelName = ch ? ch.name : "general";
  const nameEl = el("channelNameDisplay");
  if (nameEl) nameEl.textContent = state.currentChannelName;
  const inputEl = el("chatInput");
  if (inputEl) inputEl.placeholder = "Message #" + state.currentChannelName;
  clearMessages();
  const { messages } = await api(`/api/channels/${channelId}/messages`);
  for (const m of messages) addMessage(m);
  state.socket?.emit("channel:join", { channelId });
}

async function ensurePeerConnection() {
  if (state.pc) return state.pc;
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }]
  });
  state.pc = pc;
  pc.onicecandidate = (ev) => {
    if (ev.candidate && state.callId) {
      state.socket?.emit("webrtc:ice-candidate", {
        callId: state.callId,
        candidate: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate
      });
    }
  };
  pc.ontrack = (ev) => {
    const remote = el("remoteVideo");
    if (remote) remote.srcObject = ev.streams[0];
  };
  if (state.localStream) {
    for (const t of state.localStream.getTracks()) pc.addTrack(t, state.localStream);
  }
  return pc;
}

function showVideoPanel() {
  const panel = el("videoCallPanel");
  if (panel) panel.classList.remove("hidden");
}

function hideVideoPanel() {
  const panel = el("videoCallPanel");
  if (panel) panel.classList.add("hidden");
}

async function startMedia(kind) {
  const wantVideo = kind === "video";
  state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantVideo });
  const localV = el("localVideo");
  if (localV) localV.srcObject = state.localStream;
  showVideoPanel();
}

async function createCall(kind) {
  if (!state.channelId) return setHint("authHint", "Select a channel first.");
  await startMedia(kind);
  await ensurePeerConnection();
  state.socket.emit("call:create", { channelId: state.channelId, kind });
}

async function joinCall() {
  const callId = (el("callId") && el("callId").value.trim()) || "";
  if (!callId) return setHint("authHint", "Enter a Call ID.");
  state.callId = callId;
  state.socket.emit("call:join", { callId });
  setHint("authHint", "Joined call. Creating offer...");
  if (!state.localStream) {
    await startMedia("video").catch(() => startMedia("voice"));
  } else {
    showVideoPanel();
  }
  await ensurePeerConnection();
  const offer = await state.pc.createOffer();
  await state.pc.setLocalDescription(offer);
  state.socket.emit("webrtc:offer", { callId, offer });
}

function hangup() {
  if (state.callId) state.socket?.emit("call:end", { callId: state.callId });
  state.callId = null;
  if (el("callId")) el("callId").value = "";
  if (state.pc) {
    state.pc.close();
    state.pc = null;
  }
  if (state.localStream) {
    state.localStream.getTracks().forEach((t) => t.stop());
    state.localStream = null;
  }
  const localV = el("localVideo");
  const remoteV = el("remoteVideo");
  if (localV) localV.srcObject = null;
  if (remoteV) remoteV.srcObject = null;
  hideVideoPanel();
}

// --- Login / Register ---
el("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  el("btnLogin").click();
});

el("btnLogin").onclick = async () => {
  try {
    const username = el("username").value.trim();
    const password = el("password").value.trim();
    const { token, user } = await api("/api/auth/login", { method: "POST", body: { username, password } });
    state.token = token;
    state.user = user;
    setHint("authHint", "");
    mountSocket();
    showScreen(true);
    await refreshServers().catch(() => {});
  } catch (e) {
    setHint("authHint", e.message || "Login failed.");
  }
};

el("btnRegister").onclick = async () => {
  try {
    const username = el("username").value.trim();
    const password = el("password").value.trim();
    const { token, user } = await api("/api/auth/register", { method: "POST", body: { username, password } });
    state.token = token;
    state.user = user;
    setHint("authHint", "");
    mountSocket();
    showScreen(true);
    await refreshServers().catch(() => {});
  } catch (e) {
    setHint("authHint", e.message || "Register failed.");
  }
};

el("btnLogout").onclick = () => {
  state.token = null;
  state.user = null;
  state.servers = [];
  state.channels = [];
  state.serverId = null;
  state.channelId = null;
  state.socket?.disconnect();
  state.socket = null;
  clearMessages();
  showScreen(false);
  setStatus("disconnected");
};

// --- Create server modal ---
el("btnAddServer").onclick = () => {
  el("modalCreateServer").classList.remove("hidden");
  el("serverName").value = "";
  setTimeout(() => el("serverName").focus(), 100);
};

el("modalServerCancel").onclick = () => el("modalCreateServer").classList.add("hidden");
el("modalCreateServer").querySelector(".modal-backdrop").onclick = () => el("modalCreateServer").classList.add("hidden");

el("modalServerCreate").onclick = async () => {
  const name = (el("serverName") && el("serverName").value.trim()) || "";
  if (!name) return;
  try {
    await api("/api/servers", { method: "POST", body: { name } });
    el("modalCreateServer").classList.add("hidden");
    await refreshServers();
  } catch (e) {
    setHint("authHint", e.message);
  }
};

// --- Create channel modal ---
el("btnCreateChannel").onclick = () => {
  if (!state.serverId) return;
  el("modalCreateChannel").classList.remove("hidden");
  const chInput = el("channelNameInput");
  if (chInput) {
    chInput.value = "";
    setTimeout(() => chInput.focus(), 100);
  }
};

el("modalChannelCancel").onclick = () => el("modalCreateChannel").classList.add("hidden");
el("modalCreateChannel").querySelector(".modal-backdrop").onclick = () => el("modalCreateChannel").classList.add("hidden");

el("modalChannelCreate").onclick = async () => {
  const input = el("channelNameInput");
  const name = (input && input.value.trim()) || "";
  if (!name || !state.serverId) return;
  try {
    await api(`/api/servers/${state.serverId}/channels`, { method: "POST", body: { name } });
    el("modalCreateChannel").classList.add("hidden");
    await refreshChannels();
  } catch (e) {
    setHint("authHint", e.message);
  }
};

// --- Chat ---
el("btnSend").onclick = () => {
  const content = el("chatInput").value.trim();
  if (!content || !state.channelId) return;
  state.socket?.emit("message:send", { channelId: state.channelId, content });
  el("chatInput").value = "";
};

el("chatInput").addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && !ev.shiftKey) {
    ev.preventDefault();
    el("btnSend").click();
  }
});

// --- Voice / Video (in chat header) ---
el("btnCreateVoice").onclick = () => createCall("voice").catch((e) => setHint("authHint", e.message));
el("btnCreateVideo").onclick = () => createCall("video").catch((e) => setHint("authHint", e.message));
el("btnJoinCall").onclick = () => joinCall().catch((e) => setHint("authHint", e.message));
el("btnHangup").onclick = () => hangup();

// Channel search (Discord-style "Find or start a conversation")
const channelSearchEl = el("channelSearch");
if (channelSearchEl) {
  channelSearchEl.addEventListener("input", () => {
    state.channelSearch = channelSearchEl.value || "";
    renderChannelList();
  });
}

// Placeholder: mute/deafen can be wired to voice later
el("btnMute").onclick = () => {};
el("btnDeafen").onclick = () => {};

showScreen(!!state.token);
setStatus("disconnected");
