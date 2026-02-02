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

app.get("/api/health", (_, res) => res.json({ ok: true }));

/* ---------------- STATIC ---------------- */

app.use(express.static(WEB_PUBLIC_DIR));
app.get("*", (_, res) =>
  res.sendFile(path.join(WEB_PUBLIC_DIR, "index.html"))
);

/* ---------------- SERVER ---------------- */

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

/* ---------------- DATA ---------------- */

const rooms = {};
const messages = {};

/* ---------------- SOCKETS ---------------- */

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  /* JOIN ROOM */
  socket.on("room:join", ({ roomId, username }) => {
    socket.join(roomId);
    socket.username = username;
    rooms[roomId] = rooms[roomId] || [];
    rooms[roomId].push(socket.id);

    socket.emit("messages:init", messages[roomId] || []);
  });

  /* SEND MESSAGE */
  socket.on("message:send", ({ roomId, content }) => {
    if (!content) return;

    const msg = {
      id: Date.now().toString(),
      user: socket.username || "guest",
      content,
      created_at: new Date().toISOString()
    };

    messages[roomId] = messages[roomId] || [];
    messages[roomId].push(msg);

    io.to(roomId).emit("message:new", msg);
  });

  /* ---------------- VIDEO CALL SIGNALING ---------------- */

  socket.on("call:offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("call:offer", { offer });
  });

  socket.on("call:answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("call:answer", { answer });
  });

  socket.on("call:ice", ({ roomId, candidate }) => {
    socket.to(roomId).emit("call:ice", { candidate });
  });

  socket.on("disconnect", () => {
    console.log("socket disconnected", socket.id);
  });
});

/* ---------------- START ---------------- */

server.listen(3000, "0.0.0.0", () =>
  console.log("Server running on 3000")
);
