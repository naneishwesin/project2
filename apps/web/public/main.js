const API = "/api";
let socket = null;
let currentUser = null;
let currentChannel = "c1";

const loginScreen = document.getElementById("loginScreen");
const app = document.getElementById("app");
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");

const messagesDiv = document.getElementById("messages");
const chatInput = document.getElementById("chatInput");
const btnSend = document.getElementById("btnSend");

/* ---------------- LOGIN ---------------- */

loginForm.onsubmit = async (e) => {
  e.preventDefault();

  const username = usernameInput.value.trim();
  if (!username) return;

  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username })
  });

  const data = await res.json();
  currentUser = data.user;

  loginScreen.classList.add("hidden");
  app.classList.remove("hidden");

  connectSocket();
};

/* ---------------- SOCKET ---------------- */

function connectSocket() {
  socket = io({
    transports: ["websocket", "polling"]
  });

  socket.on("connect", () => {
    socket.emit("room:join", {
      roomId: currentChannel,
      username: currentUser.username
    });
  });

  socket.on("messages:init", (msgs) => {
    messagesDiv.innerHTML = "";
    msgs.forEach(addMessage);
  });

  socket.on("message:new", addMessage);
}

/* ---------------- CHAT ---------------- */

btnSend.onclick = sendMessage;
chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendMessage();
});

function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  socket.emit("message:send", {
    roomId: currentChannel,
    content: text
  });

  chatInput.value = "";
}

function addMessage(msg) {
  const div = document.createElement("div");
  div.className = "message";
  div.textContent = `${msg.user}: ${msg.content}`;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
