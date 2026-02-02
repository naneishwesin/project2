import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";

dotenv.config();

/* -------------------------------------------------- */
/* PATH SETUP                                         */
/* -------------------------------------------------- */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

// IMPORTANT: this MUST point to your frontend public folder
const WEB_PUBLIC_DIR = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "apps",
  "web",
  "public"
);

/* -------------------------------------------------- */
/* IN-MEMORY DEMO DATA (NO DB YET)                    */
/* -------------------------------------------------- */

const servers = [
  { id: "s1", name: "Demo Server" }
];

const channels = {
  s1: [
    { id: "c1", name: "general", type: "text" }
  ]
};

const messages = {
  c1: [
    {
      id: "m1",
      content: "Welcome to the demo 👋",
      username: "system",
      created_at: new Date().toISOString()
    }
  ]
};

/* -------------------------------------------------- */
/* EXPRESS APP                                       */
/* -------------------------------------------------- */

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

/* -------------------------------------------------- */
/* HEALTH (ALB + DEBUG)                              */
/* -------------------------------------------------- */

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

/* -------------------------------------------------- */
/* AUTH (MATCHES FRONTEND EXPECTATION)               */
/* -------------------------------------------------- */

app.post("/api/auth/login", (req, res) => {
  res.json({
    token: "demo-token",
    user: {
      id: "u1",
      username: req.body.username || "demo"
    }
  });
});

app.post("/api/auth/register", (req, res) => {
  res.json({
    token: "demo-token",
    user: {
      id: "u1",
      username: req.body.username || "demo"
    }
  });
});

/* -------------------------------------------------- */
/* SERVERS / CHANNELS / MESSAGES API                 */
/* -------------------------------------------------- */

app.get("/api/servers", (req, res) => {
  res.json({ servers });
});

app.get("/api/servers/:id/channels", (req, res) => {
  res.json({ channels: channels[req.params.id] || [] });
});

app.get("/api/channels/:id/messages", (req, res) => {
  res.json({ messages: messages[req.params.id] || [] });
});

/* -------------------------------------------------- */
/* STATIC FRONTEND                                  */
/* -------------------------------------------------- */

app.use(express.static(WEB_PUBLIC_DIR));

app.get("*", (req, res) => {
  res.sendFile(path.join(WEB_PUBLIC_DIR, "index.html"));
});

/* -------------------------------------------------- */
/* HTTP + SOCKET.IO                                 */
/* -------------------------------------------------- */

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("socket connected");

  socket.on("message:send", ({ channelId, content }) => {
    if (!content) return;

    const msg = {
      id: Date.now().toString(),
      content,
      username: "demo",
      created_at: new Date().toISOString()
    };

    messages[channelId] = messages[channelId] || [];
    messages[channelId].push(msg);

    io.emit("message:new", msg);
  });
});

/* -------------------------------------------------- */
/* START                                            */
/* -------------------------------------------------- */

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on ${PORT}`);
});
