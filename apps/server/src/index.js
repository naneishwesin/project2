import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";

/* ---------------- ENV ---------------- */
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const WEB_PUBLIC_DIR = path.join(__dirname, "..", "..", "apps", "web", "public");

/* ---------------- APP ---------------- */
const app = express();
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(helmet({ contentSecurityPolicy: false }));

/* ---------------- HEALTH ---------------- */
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

/* ---------------- FAKE DATA ---------------- */
let servers = [
  { id: "1", name: "EAD project2" }
];

let channels = {
  "1": [{ id: "1", name: "general", serverId: "1" }]
};

let messages = {
  "1": []
};

/* ---------------- AUTH (FAKE) ---------------- */
app.post("/api/auth/login", (req, res) => {
  res.json({ user: { id: "u1", email: "test@test.com" } });
});

app.post("/api/auth/register", (req, res) => {
  res.json({ user: { id: "u1", email: "test@test.com" } });
});

/* ---------------- SERVERS ---------------- */
app.get("/api/servers", (req, res) => {
  res.json(servers);
});

app.post("/api/servers", (req, res) => {
  const s = { id: Date.now().toString(), name: req.body.name };
  servers.push(s);
  channels[s.id] = [{ id: "general", name: "general", serverId: s.id }];
  res.json(s);
});

/* ---------------- CHANNELS ---------------- */
app.get("/api/servers/:id/channels", (req, res) => {
  res.json(channels[req.params.id] || []);
});

app.post("/api/servers/:id/channels", (req, res) => {
  const ch = {
    id: Date.now().toString(),
    name: req.body.name,
    serverId: req.params.id
  };
  channels[req.params.id].push(ch);
  messages[ch.id] = [];
  res.json(ch);
});

/* ---------------- MESSAGES ---------------- */
app.get("/api/channels/:id/messages", (req, res) => {
  res.json(messages[req.params.id] || []);
});

app.post("/api/channels/:id/messages", (req, res) => {
  const msg = {
    id: Date.now().toString(),
    content: req.body.content,
    user: "You"
  };
  messages[req.params.id].push(msg);
  io.emit("message", msg);
  res.json(msg);
});

/* ---------------- STATIC FRONTEND ---------------- */
app.use(express.static(WEB_PUBLIC_DIR));

app.get("*", (req, res) => {
  res.sendFile(path.join(WEB_PUBLIC_DIR, "index.html"));
});

/* ---------------- SOCKET.IO ---------------- */
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on("connection", () => {
  console.log("socket connected");
});

/* ---------------- START ---------------- */
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on ${PORT}`);
});
