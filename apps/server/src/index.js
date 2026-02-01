import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import http from "http";
import jwt from "jsonwebtoken";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";

import {
  insecureHashPassword,
  newId,
  requireAuth,
  signToken
} from "./auth.js";
import { getPool, pingDb } from "./db.js";
import { getRedis } from "./redis.js";

/* ------------------------------------------------------------------ */
/*  ENV + PATHS                                                        */
/* ------------------------------------------------------------------ */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// load .env from project root
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const PORT = Number(process.env.PORT || 3000);
const WEB_ORIGIN = process.env.WEB_ORIGIN || "*";

// frontend location
const WEB_PUBLIC_DIR = path.join(__dirname, "..", "..", "web", "public");

/* ------------------------------------------------------------------ */
/*  EXPRESS APP                                                        */
/* ------------------------------------------------------------------ */

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: WEB_ORIGIN === "*" ? true : WEB_ORIGIN,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

/* ------------------------------------------------------------------ */
/*  HEALTH CHECK                                                       */
/* ------------------------------------------------------------------ */

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
    if (r) {
      await r.ping();
      details.redis = true;
    } else {
      details.redis = true; // redis disabled but OK
    }
  } catch {
    details.ok = false;
  }

  res.status(details.ok ? 200 : 503).json(details);
});

/* ------------------------------------------------------------------ */
/*  AUTH API                                                          */
/* ------------------------------------------------------------------ */

app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "missing_fields" });
  }

  const pool = getPool();
  const id = newId();
  const passwordHash = insecureHashPassword(password);

  try {
    await pool.query(
      "insert into users (id, username, password_hash) values ($1,$2,$3)",
      [id, username, passwordHash]
    );
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "username_taken" });
    return res.status(503).json({ error: "database_unavailable" });
  }

  return res.json({
    token: signToken({ id, username }),
    user: { id, username }
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "missing_fields" });
  }

  const pool = getPool();
  const passwordHash = insecureHashPassword(password);

  const result = await pool.query(
    "select id, username from users where username=$1 and password_hash=$2 limit 1",
    [username, passwordHash]
  );

  const user = result.rows?.[0];
  if (!user) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  return res.json({
    token: signToken(user),
    user
  });
});

/* ------------------------------------------------------------------ */
/*  SERVERS + CHANNELS API                                             */
/* ------------------------------------------------------------------ */

function isDbConnectionError(err) {
  return err && ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"].includes(err.code);
}

app.get("/api/servers", requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      "select id, name from servers order by created_at desc limit 50"
    );
    res.json({ servers: rows });
  } catch (err) {
    if (isDbConnectionError(err)) {
      return res.status(503).json({ error: "database_unavailable" });
    }
    throw err;
  }
});

/* ------------------------------------------------------------------ */
/*  STATIC FRONTEND (IMPORTANT)                                       */
/* ------------------------------------------------------------------ */

// serve frontend assets
app.use(express.static(WEB_PUBLIC_DIR));

// SPA fallback → index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(WEB_PUBLIC_DIR, "index.html"));
});

/* ------------------------------------------------------------------ */
/*  HTTP + SOCKET.IO                                                   */
/* ------------------------------------------------------------------ */

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: WEB_ORIGIN,
    methods: ["GET", "POST"]
  }
});

const JWT_SECRET_WS = process.env.JWT_SECRET || "dev-secret-change-me";

io.use((socket, next) => {
  const token =
    socket.handshake.auth?.token ||
    (socket.handshake.headers.authorization || "").split(" ")[1];

  if (!token) return next(new Error("missing_token"));

  try {
    const payload = jwt.verify(token, JWT_SECRET_WS);
    socket.user = { id: payload.sub, username: payload.username };
    next();
  } catch {
    next(new Error("invalid_token"));
  }
});

/* ---- socket logic unchanged (chat, voice, calls) ---- */
/* your existing Socket.IO code can remain exactly same */

/* ------------------------------------------------------------------ */
/*  START SERVER                                                       */
/* ------------------------------------------------------------------ */

server.listen(PORT, "0.0.0.0", () => {
  console.log(`RTCP running on port ${PORT}`);
});
