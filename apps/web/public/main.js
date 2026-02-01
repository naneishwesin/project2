// Default: AWS ALB. For local dev, set window.__API_BASE__ = "http://localhost:3000" before loading main.js
const API_BASE = (typeof window !== "undefined" && window.__API_BASE__) || "http://rtcp-alb-1195294811.ap-southeast-1.elb.amazonaws.com";

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
  channelSearch: "",
  voiceChannelId: null,
  voicePeers: {},
  voiceChannelMembers: []
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

  // --- Voice channels (Discord-style) ---
  state.socket.on("voice-channel:members", async ({ channelId, members }) => {
    if (channelId !== state.voiceChannelId) return;
    state.voiceChannelMembers = members || [];
    updateMainView();
    for (const m of state.voiceChannelMembers) {
      if (m.id === state.user?.id) continue;
      await ensureVoicePeer(channelId, m.id, true);
    }
  });

  state.socket.on("voice-channel:user-joined", async ({ channelId, user }) => {
    if (channelId !== state.voiceChannelId || user.id === state.user?.id) return;
    state.voiceChannelMembers = [...(state.voiceChannelMembers || []), user];
    updateMainView();
    await ensureVoicePeer(channelId, user.id, true);
  });

  state.socket.on("voice-channel:user-left", ({ channelId, user }) => {
    if (channelId !== state.voiceChannelId) return;
    state.voiceChannelMembers = (state.voiceChannelMembers || []).filter((m) => m.id !== user.id);
    updateMainView();
    const pc = state.voicePeers?.[user.id];
    if (pc) {
      try { pc.close(); } catch {}
      delete state.voicePeers[user.id];
    }
  });

  state.socket.on("voice-signal:offer", async ({ channelId, from, fromUsername, offer }) => {
    if (channelId !== state.voiceChannelId || from === state.user?.id) return;
    const pc = await ensureVoicePeer(channelId, from, false);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    state.socket.emit("voice-signal:answer", { channelId, toUserId: from, answer });
  });

  state.socket.on("voice-signal:answer", async ({ channelId, from, answer }) => {
    if (channelId !== state.voiceChannelId) return;
    const pc = state.voicePeers?.[from];
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  });

  state.socket.on("voice-signal:ice", async ({ channelId, from, candidate }) => {
    if (channelId !== state.voiceChannelId) return;
    const pc = state.voicePeers?.[from];
    if (!pc) return;
    try {
      const c = candidate && typeof candidate === "object" ? new RTCIceCandidate(candidate) : candidate;
      await pc.addIceCandidate(c);
    } catch {}
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
  const q = (state.channelSearch || "").trim().toLowerCase();
  const channels = q ? state.channels.filter((c) => (c.name || "").toLowerCase().includes(q)) : state.channels;
  const textChannels = channels.filter((c) => (c.type || "text") === "text");
  const voiceChannels = channels.filter((c) => c.type === "voice");

  const textContainer = el("textChannelList");
  if (textContainer) {
    textContainer.innerHTML = "";
    for (const c of textChannels) {
      const item = document.createElement("div");
      item.className = "channel-item" + (state.channelId === c.id ? " active" : "");
      item.innerHTML = `<span class="hash">#</span><span>${escapeHtml(c.name)}</span>`;
      item.onclick = () => selectTextChannel(c.id);
      textContainer.appendChild(item);
    }
  }

  const voiceContainer = el("voiceChannelList");
  if (voiceContainer) {
    voiceContainer.innerHTML = "";
    for (const c of voiceChannels) {
      const item = document.createElement("div");
      const inThisVoice = state.voiceChannelId === c.id;
      item.className = "channel-item channel-item-voice" + (inThisVoice ? " active" : "");
      item.innerHTML = `<span class="voice-icon" aria-hidden="true">🔊</span><span class="channel-voice-name">${escapeHtml(c.name)}</span><span class="voice-join-leave">${inThisVoice ? "Leave" : "Join"}</span>`;
      item.onclick = () => {
        if (state.voiceChannelId === c.id) leaveVoiceChannel();
        else joinVoiceChannel(c.id);
      };
      voiceContainer.appendChild(item);
    }
  }
}

function updateMainView() {
  const emptyState = el("emptyState");
  const voiceView = el("voiceChannelView");
  const chatContent = el("chatContent");
  const startMarker = el("channelStartMarker");
  const startText = el("channelStartText");
  const channelNameDisplay = el("channelNameDisplay");

  if (state.voiceChannelId) {
    if (emptyState) emptyState.classList.add("hidden");
    if (chatContent) chatContent.classList.add("hidden");
    if (voiceView) voiceView.classList.remove("hidden");
    const vc = state.channels.find((c) => c.id === state.voiceChannelId);
    const nameEl = el("voiceChannelViewName");
    if (nameEl) nameEl.textContent = vc ? vc.name : "Voice Channel";
    const membersEl = el("voiceChannelMembers");
    if (membersEl) {
      const me = state.user?.username ? [state.user.username] : [];
      const others = (state.voiceChannelMembers || []).map((m) => m.username).filter(Boolean);
      membersEl.textContent = [ ...me, ...others ].length ? "In channel: " + [ ...me, ...others ].join(", ") : "You're the only one here.";
    }
    if (channelNameDisplay) channelNameDisplay.textContent = vc ? vc.name : "Voice";
    const prefix = el("channelHeaderPrefix");
    if (prefix) prefix.textContent = "🔊";
  } else if (state.channelId) {
    if (emptyState) emptyState.classList.add("hidden");
    if (voiceView) voiceView.classList.add("hidden");
    if (chatContent) chatContent.classList.remove("hidden");
    if (startMarker) startMarker.classList.remove("hidden");
    if (startText) startText.textContent = "This is the start of #" + (state.currentChannelName || "general");
    if (channelNameDisplay) channelNameDisplay.textContent = state.currentChannelName || "general";
    const prefix = el("channelHeaderPrefix");
    if (prefix) prefix.textContent = "#";
  } else {
    if (voiceView) voiceView.classList.add("hidden");
    if (chatContent) chatContent.classList.add("hidden");
    if (startMarker && el("channelStartMarker")) el("channelStartMarker").classList.add("hidden");
    if (emptyState) emptyState.classList.remove("hidden");
    if (channelNameDisplay) channelNameDisplay.textContent = "general";
    const prefix = el("channelHeaderPrefix");
    if (prefix) prefix.textContent = "#";
  }
}

function selectTextChannel(channelId) {
  if (!channelId) return;
  state.channelId = channelId;
  const ch = state.channels.find((c) => c.id === channelId);
  state.currentChannelName = ch ? ch.name : "general";
  const inputEl = el("chatInput");
  if (inputEl) inputEl.placeholder = "Message #" + state.currentChannelName;
  clearMessages();
  api(`/api/channels/${channelId}/messages`)
    .then(({ messages }) => { for (const m of messages) addMessage(m); })
    .catch(() => {});
  state.socket?.emit("channel:join", { channelId });
  renderChannelList();
  updateMainView();
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
  state.voiceChannelId = null;
  leaveVoiceChannel();
  renderChannelList();
  const firstText = state.channels.find((c) => (c.type || "text") === "text");
  if (firstText) selectTextChannel(firstText.id);
  else {
    state.channelId = null;
    state.currentChannelName = "general";
    clearMessages();
    if (el("chatInput")) el("chatInput").placeholder = "Message #general";
    updateMainView();
  }
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

// --- Voice channels (Discord-style) ---
async function joinVoiceChannel(channelId) {
  if (!channelId || !state.socket) return;
  leaveVoiceChannel();
  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const localV = el("localVideo");
    if (localV) localV.srcObject = state.localStream;
    showVideoPanel();
  } catch (e) {
    setHint("authHint", "Microphone access denied.");
    return;
  }
  state.voiceChannelId = channelId;
  state.socket.emit("voice-channel:join", { channelId });
  setHint("authHint", "Joined voice channel.");
  renderChannelList();
  updateMainView();
}

function leaveVoiceChannel() {
  if (state.voiceChannelId && state.socket) {
    state.socket.emit("voice-channel:leave", { channelId: state.voiceChannelId });
  }
  state.voiceChannelId = null;
  Object.values(state.voicePeers || {}).forEach((pc) => { try { pc.close(); } catch {} });
  state.voicePeers = {};
  state.voiceChannelMembers = [];
  if (state.localStream && !state.callId) {
    state.localStream.getTracks().forEach((t) => t.stop());
    state.localStream = null;
    const localV = el("localVideo");
    if (localV) localV.srcObject = null;
    hideVideoPanel();
  }
  renderChannelList();
  updateMainView();
}

async function ensureVoicePeer(channelId, userId, isInitiator) {
  if (!state.voicePeers) state.voicePeers = {};
  if (state.voicePeers[userId]) return state.voicePeers[userId];
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  state.voicePeers[userId] = pc;
  pc.onicecandidate = (ev) => {
    if (ev.candidate && state.socket) state.socket.emit("voice-signal:ice", { channelId, toUserId: userId, candidate: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate });
  };
  pc.ontrack = (ev) => {
    const remote = el("remoteVideo");
    if (remote) remote.srcObject = ev.streams[0];
  };
  if (state.localStream) state.localStream.getTracks().forEach((t) => pc.addTrack(t, state.localStream));
  if (isInitiator) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (state.socket) state.socket.emit("voice-signal:offer", { channelId, toUserId: userId, offer });
  }
  return pc;
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
  leaveVoiceChannel();
  state.token = null;
  state.user = null;
  state.servers = [];
  state.channels = [];
  state.serverId = null;
  state.channelId = null;
  state.voiceChannelId = null;
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

// --- Server dropdown (Discord-style) ---
el("serverNameWrap").onclick = () => {
  const dd = el("serverDropdown");
  if (dd) dd.classList.toggle("hidden");
};
document.addEventListener("click", (e) => {
  const dd = el("serverDropdown");
  const wrap = el("serverNameWrap");
  if (dd && !dd.classList.contains("hidden") && wrap && !wrap.contains(e.target) && !dd.contains(e.target)) dd.classList.add("hidden");
});
el("serverDropdownInvite").onclick = () => { setHint("authHint", "Invite link not implemented."); el("serverDropdown").classList.add("hidden"); };
el("serverDropdownSettings").onclick = () => { setHint("authHint", "Server settings not implemented."); el("serverDropdown").classList.add("hidden"); };

// --- Collapsible categories (Discord-style) ---
function toggleCategory(categoryId) {
  const btn = el(categoryId === "text" ? "categoryTextToggle" : "categoryVoiceToggle");
  const wrap = el(categoryId === "text" ? "textChannelListWrap" : "voiceChannelListWrap");
  if (!btn || !wrap) return;
  const expanded = btn.getAttribute("aria-expanded") !== "false";
  btn.setAttribute("aria-expanded", !expanded);
  wrap.classList.toggle("collapsed", expanded);
}
el("categoryTextToggle").onclick = () => toggleCategory("text");
el("categoryVoiceToggle").onclick = () => toggleCategory("voice");

// --- Create channel: generic and per-category + (Discord-style) ---
function openCreateChannelModal(type) {
  if (!state.serverId) return;
  const textRadio = document.querySelector('input[name="channelType"][value="text"]');
  const voiceRadio = document.querySelector('input[name="channelType"][value="voice"]');
  if (type === "voice" && voiceRadio) voiceRadio.checked = true;
  else if (textRadio) textRadio.checked = true;
  el("modalCreateChannel").classList.remove("hidden");
  const chInput = el("channelNameInput");
  if (chInput) { chInput.value = ""; setTimeout(() => chInput.focus(), 100); }
}
el("btnCreateChannel").onclick = () => openCreateChannelModal("text");
el("btnAddTextChannel").onclick = (e) => { e.stopPropagation(); openCreateChannelModal("text"); };
el("btnAddVoiceChannel").onclick = (e) => { e.stopPropagation(); openCreateChannelModal("voice"); };

el("modalChannelCancel").onclick = () => el("modalCreateChannel").classList.add("hidden");
el("modalCreateChannel").querySelector(".modal-backdrop").onclick = () => el("modalCreateChannel").classList.add("hidden");

el("modalChannelCreate").onclick = async () => {
  const input = el("channelNameInput");
  const name = (input && input.value.trim()) || "";
  if (!name || !state.serverId) return;
  const typeEl = document.querySelector('input[name="channelType"]:checked');
  const type = (typeEl && typeEl.value) === "voice" ? "voice" : "text";
  try {
    await api(`/api/servers/${state.serverId}/channels`, { method: "POST", body: { name, type } });
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

el("btnLeaveVoiceChannel").onclick = () => leaveVoiceChannel();

el("btnAttach").onclick = () => setHint("authHint", "File upload not implemented.");
el("btnEmoji").onclick = () => setHint("authHint", "Emoji picker not implemented.");

// Channel search (Discord-style)
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
