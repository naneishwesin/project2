let socket;
let currentChannel = "c1";
let user;

const loginDiv = document.getElementById("login");
const appDiv = document.getElementById("app");
const serversDiv = document.getElementById("servers");
const messagesDiv = document.getElementById("messages");
const input = document.getElementById("input");

/* ---- Login ---- */

document.getElementById("loginBtn").onclick = async () => {
  const username = document.getElementById("username").value;
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username })
  });
  user = (await res.json()).user;

  loginDiv.style.display = "none";
  appDiv.style.display = "flex";

  socket = io();
  loadServers();
  joinChannel("c1");
};

/* ---- Servers + Channels ---- */

async function loadServers() {
  const res = await fetch("/api/servers");
  const servers = await res.json();

  serversDiv.innerHTML = "";
  servers[0].channels &&
    Object.values(servers[0].channels).forEach(ch => {
      const btn = document.createElement("button");
      btn.textContent = "# " + ch.name;
      btn.onclick = () => joinChannel(ch.id);
      serversDiv.appendChild(btn);
    });
}

/* ---- Socket ---- */

function joinChannel(id) {
  currentChannel = id;
  messagesDiv.innerHTML = "";

  socket.emit("join", {
    channelId: id,
    username: user.username
  });

  socket.off("messages");
  socket.off("message");

  socket.on("messages", msgs => {
    msgs.forEach(addMessage);
  });

  socket.on("message", addMessage);
}

function addMessage(m) {
  const div = document.createElement("div");
  div.textContent = `${m.user}: ${m.text}`;
  messagesDiv.appendChild(div);
}

/* ---- Send ---- */

input.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    socket.emit("send", {
      channelId: currentChannel,
      text: input.value
    });
    input.value = "";
  }
});
