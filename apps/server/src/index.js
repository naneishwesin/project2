import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* ENV + PATHS                                                         */
/* ------------------------------------------------------------------ */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const WEB_ORIGIN = "*";

// adjust if your structure differs
const WEB_PUBLIC_DIR = path.join(__dirname, "public");

/* ------------------------------------------------------------------ */
/* EXPRESS APP                                                         */
/* ------------------------------------------------------------------ */

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

/* ------------------------------------------------------------------ */
/* HEALTH CHECK (ALB USES THIS)                                        */
/* ------------------------------------------------------------------ */

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

/* ------------------------------------------------------------------ */
/* API (MUST COME BEFORE STATIC)                                       */
/* ------------------------------------------------------------------ */

app.post("/api/auth/login", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/register", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/test", (req, res) => {
  res.json({ message: "API WORKS" });
});

/* ------------------------------------------------------------------ */
/* STATIC FRONTEND (LAST)                                              */
/* ------------------------------------------------------------------ */

app.use(express.static(WEB_PUBLIC_DIR));

app.get("*", (req, res) => {
  res.sendFile(path.join(WEB_PUBLIC_DIR, "index.html"));
});

/* ------------------------------------------------------------------ */
/* HTTP + SOCKET.IO                                                    */
/* ------------------------------------------------------------------ */

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on("connection", (socket) => {
  console.log("socket connected");
});

/* ------------------------------------------------------------------ */
/* START                                                               */
/* ------------------------------------------------------------------ */

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on ${PORT}`);
});
