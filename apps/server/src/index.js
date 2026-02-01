import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import http from "http";
import jwt from "jsonwebtoken";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { insecureHashPassword, newId, requireAuth, signToken } from "./auth.js";
import { getPool, pingDb } from "./db.js";
import { getRedis } from "./redis.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const PORT = Number(process.env.PORT || 3000);
const WEB_ORIGIN = process.env.WEB_ORIGIN || "http://localhost:3001";

const app = express();
app.use(helmet());
app.use(cors({ origin: WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/", (req, res) => {
  res.type("html").status(200).send(`
    <!DOCTYPE html>
    <html><head><meta charset="utf-8"><title>RTCP API</title></head>
    <body style="font-family:system-ui;padding:2rem;">
      <h1>API server</h1>
      <p>This is the backend (API + WebSocket). There is no UI here.</p>
      <p><a href="${WEB_ORIGIN}">Open the app → ${WEB_ORIGIN}</a></p>
      <p><a href="/health">/health</a> — check server status</p>
    </body></html>
  `);
});

app.get("/health", async (req, res) => {
  const details = {
    ok: true,
    db: false,
    redis: false,
    time: new Date().toISOString()
  };

  try {
    details.db = await pingDb();
  } catch {
    details.ok = false;
  }

  try {
    const r = await getRedis();
    await r.ping();
    details.redis = true;
  } catch {
    details.ok = false;
  }

  res.status(details.ok ? 200 : 503).json(details);
});

// --- Auth (demo) ---
app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "missing_fields" });

  const pool = getPool();
  const id = newId();
  const passwordHash = insecureHashPassword(password);

  try {
    await pool.query("insert into users (id, username, password_hash) values ($1,$2,$3)", [
      id,
      username,
      passwordHash
    ]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "username_taken" });
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND")
      return res.status(503).json({ error: "database_unavailable" });
    throw err;
  }

  return res.json({ token: signToken({ id, username }), user: { id, username } });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "missing_fields" });

  const pool = getPool();
  const passwordHash = insecureHashPassword(password);
  let rows;
  try {
    const result = await pool.query(
      "select id, username from users where username=$1 and password_hash=$2 limit 1",
      [username, passwordHash]
    );
    rows = result.rows;
  } catch (err) {
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND")
      return res.status(503).json({ error: "database_unavailable" });
    throw err;
  }
  const user = rows?.[0];
  if (!user) return res.status(401).json({ error: "invalid_credentials" });
  return res.json({ token: signToken(user), user });
});

function isDbConnectionError(err) {
  return err && (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND" || err.code === "ETIMEDOUT");
}

// --- Servers + Channels ---
app.get("/api/servers", requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query("select id, name from servers order by created_at desc limit 50");
    return res.json({ servers: rows });
  } catch (err) {
    if (isDbConnectionError(err)) return res.status(503).json({ error: "database_unavailable" });
    throw err;
  }
});

app.post("/api/servers", requireAuth, async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "missing_name" });
  try {
    const pool = getPool();
    const id = newId();
    await pool.query("insert into servers (id, name) values ($1,$2)", [id, name]);
    return res.json({ server: { id, name } });
  } catch (err) {
    if (isDbConnectionError(err)) return res.status(503).json({ error: "database_unavailable" });
    throw err;
  }
});

app.get("/api/servers/:serverId/channels", requireAuth, async (req, res) => {
  const { serverId } = req.params;
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      "select id, server_id, name from channels where server_id=$1 order by created_at asc",
      [serverId]
    );
    return res.json({ channels: rows });
  } catch (err) {
    if (isDbConnectionError(err)) return res.status(503).json({ error: "database_unavailable" });
    throw err;
  }
});

app.post("/api/servers/:serverId/channels", requireAuth, async (req, res) => {
  const { serverId } = req.params;
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "missing_name" });
  try {
    const pool = getPool();
    const id = newId();
    await pool.query("insert into channels (id, server_id, name) values ($1,$2,$3)", [
      id,
      serverId,
      name
    ]);
    return res.json({ channel: { id, server_id: serverId, name } });
  } catch (err) {
    if (isDbConnectionError(err)) return res.status(503).json({ error: "database_unavailable" });
    throw err;
  }
});

// Message history
app.get("/api/channels/:channelId/messages", requireAuth, async (req, res) => {
  const { channelId } = req.params;
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      "select id, channel_id, user_id, username, content, created_at from messages where channel_id=$1 order by created_at desc limit 50",
      [channelId]
    );
    return res.json({ messages: rows.reverse() });
  } catch (err) {
    if (isDbConnectionError(err)) return res.status(503).json({ error: "database_unavailable" });
    throw err;
  }
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: WEB_ORIGIN,
    methods: ["GET", "POST"]
  }
});

function channelRoom(channelId) {
  return `channel:${channelId}`;
}

function callRoom(callId) {
  return `call:${callId}`;
}

async function setPresence(userId, username, isOnline) {
  const r = await getRedis();
  const key = "presence:online";
  if (isOnline) {
    await r.hSet(key, userId, JSON.stringify({ userId, username, at: Date.now() }));
  } else {
    await r.hDel(key, userId);
  }
}

const JWT_SECRET_WS = process.env.JWT_SECRET || "dev-secret-change-me";

io.use(async (socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    (socket.handshake.headers.authorization || "").split(" ")[1] ||
    null;

  if (!token) return next(new Error("missing_token"));
  try {
    const payload = jwt.verify(token, JWT_SECRET_WS);
    socket.user = { id: payload.sub, username: payload.username };
    return next();
  } catch {
    return next(new Error("invalid_token"));
  }
});

io.on("connection", (socket) => {
  const { id: userId, username } = socket.user;

  setPresence(userId, username, true).catch(() => {});

  socket.on("disconnect", () => {
    setPresence(userId, username, false).catch(() => {});
  });

  // --- Chat ---
  socket.on("channel:join", async ({ channelId }) => {
    if (!channelId) return;
    await socket.join(channelRoom(channelId));
    socket.emit("channel:joined", { channelId });
  });

  socket.on("channel:leave", async ({ channelId }) => {
    if (!channelId) return;
    await socket.leave(channelRoom(channelId));
    socket.emit("channel:left", { channelId });
  });

  socket.on("message:send", async ({ channelId, content }) => {
    if (!channelId || !content) return;
    const pool = getPool();
    const msg = {
      id: newId(),
      channel_id: channelId,
      user_id: userId,
      username,
      content: String(content).slice(0, 2000),
      created_at: new Date().toISOString()
    };

    // Write-through to DB (history)
    try {
      await pool.query(
        "insert into messages (id, channel_id, user_id, username, content, created_at) values ($1,$2,$3,$4,$5,$6)",
        [msg.id, msg.channel_id, msg.user_id, msg.username, msg.content, msg.created_at]
      );
    } catch {
      // don't crash realtime path
    }

    // Cache last 50 messages per channel (for low latency)
    getRedis()
      .then((r) =>
        r
          .multi()
          .lPush(`cache:channel:${channelId}:messages`, JSON.stringify(msg))
          .lTrim(`cache:channel:${channelId}:messages`, 0, 49)
          .exec()
      )
      .catch(() => {});

    io.to(channelRoom(channelId)).emit("message:new", msg);
  });

  // --- WebRTC Signaling (P2P voice/video) ---
  socket.on("call:create", async ({ channelId, kind }) => {
    if (!channelId || (kind !== "voice" && kind !== "video")) return;
    const callId = newId();

    // Store metadata (optional; ok if DB down for demo)
    try {
      await getPool().query(
        "insert into calls (id, channel_id, created_by, kind) values ($1,$2,$3,$4)",
        [callId, channelId, userId, kind]
      );
    } catch {}

    await socket.join(callRoom(callId));
    socket.emit("call:created", { callId, channelId, kind });
    io.to(channelRoom(channelId)).emit("call:announced", { callId, channelId, kind, by: username });
  });

  socket.on("call:join", async ({ callId }) => {
    if (!callId) return;
    await socket.join(callRoom(callId));
    socket.emit("call:joined", { callId });
    socket.to(callRoom(callId)).emit("call:peer-joined", { callId, user: { id: userId, username } });
  });

  socket.on("webrtc:offer", ({ callId, offer }) => {
    if (!callId || !offer) return;
    socket.to(callRoom(callId)).emit("webrtc:offer", { callId, from: userId, offer });
  });

  socket.on("webrtc:answer", ({ callId, answer }) => {
    if (!callId || !answer) return;
    socket.to(callRoom(callId)).emit("webrtc:answer", { callId, from: userId, answer });
  });

  socket.on("webrtc:ice-candidate", ({ callId, candidate }) => {
    if (!callId || !candidate) return;
    socket.to(callRoom(callId)).emit("webrtc:ice-candidate", { callId, from: userId, candidate });
  });

  socket.on("call:end", async ({ callId }) => {
    if (!callId) return;
    try {
      await getPool().query("update calls set ended_at=now() where id=$1", [callId]);
    } catch {}
    io.to(callRoom(callId)).emit("call:ended", { callId });
  });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other process or set PORT to another number.`);
  } else {
    console.error("Server error:", err.message);
  }
  process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`server listening on http://localhost:${PORT}`);
});

