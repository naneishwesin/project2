import cors from "cors";
import express from "express";
import helmet from "helmet";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";

/* ---------------- PATHS ---------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WEB_PUBLIC_DIR = path.join(__dirname, "..", "..", "..", "apps", "web", "public");

/* ---------------- APP ---------------- */

const app = express();
app.use(cors({ origin: "*" }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());

/* ---------------- STATE ---------------- */

const users = {};
const servers = {};
const channels = {};
const messages = {};

/* ---------------- API ---------------- */

app.get("/api/health", (_, res) => res.json({ ok: true }));

app.post("/api/auth/login", (req, res) => {
  const { username } = req.body;
  users[username] = { username };
  res.json({ user: { username } });
});

app.post("/api/servers", (req, res) => {
  const id = "s1";
  servers[id] = { id, name: "Demo Server" };
  channels[id] = [{ id: "c1", name: "general", type: "text" }];
  res.json(servers[id]);
});

app.get("/api/servers", (_, res) => {
  res.json(Object.values(servers));
});

app.get("/api/servers/:id/channels", (req, res) => {
  res.json(channels[req.params.id] || []);
});

/* ---------------- STATIC ---------------- */

app.use(express.static(WEB_PUBLIC_DIR));
app.get("*", (_, res) => res.sendFile(path.join(WEB_PUBLIC_DIR, "index.html")));

/* ---------------- SOCKET ---------------- */

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("🔌 socket connected", socket.id);

  socket.on("room:join", ({ roomId, username }) => {
    socket.join(roomId);
    socket.username = username;
    socket.emit("messages:init", messages[roomId] || []);
  });

  socket.on("message:send", ({ roomId, content }) => {
    const msg = {
      id: Date.now().toString(),
      user: socket.username,
      content,
      at: new Date().toISOString()
    };
    messages[roomId] = messages[roomId] || [];
    messages[roomId].push(msg);
    io.to(roomId).emit("message:new", msg);
  });

  socket.on("call:offer", d => socket.to(d.roomId).emit("call:offer", d));
  socket.on("call:answer", d => socket.to(d.roomId).emit("call:answer", d));
  socket.on("call:ice", d => socket.to(d.roomId).emit("call:ice", d));
});

/* ---------------- START ---------------- */

server.listen(3000, "0.0.0.0", () => {
  console.log("✅ Server running on 3000");
});
