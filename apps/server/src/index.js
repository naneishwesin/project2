import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import http from "http";
import { Server } from "socket.io";

/* ---------------------------------------------------- */
/* ENV                                                  */
/* ---------------------------------------------------- */

dotenv.config();

const PORT = Number(process.env.PORT || 3000);

/* ---------------------------------------------------- */
/* APP                                                  */
/* ---------------------------------------------------- */

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

/* ---------------------------------------------------- */
/* HEALTH (ALB + DEBUG)                                 */
/* ---------------------------------------------------- */

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

/* ---------------------------------------------------- */
/* API ROUTES                                           */
/* ---------------------------------------------------- */

const api = express.Router();

/* ---- AUTH ---- */

api.post("/auth/login", (req, res) => {
  res.json({ ok: true, user: { username: req.body.username } });
});

api.post("/auth/register", (req, res) => {
  res.json({ ok: true });
});

/* ---- CHANNELS (stub so UI WORKS) ---- */

api.get("/channels", (req, res) => {
  res.json([]);
});

api.post("/channels", (req, res) => {
  res.json({ ok: true });
});

/* ---- MESSAGES (stub) ---- */

api.get("/messages", (req, res) => {
  res.json([]);
});

api.post("/messages", (req, res) => {
  res.json({ ok: true });
});

app.use("/api", api);

/* ---------------------------------------------------- */
/* HTTP + SOCKET.IO                                     */
/* ---------------------------------------------------- */

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on("connection", (socket) => {
  console.log("socket connected");
});

/* ---------------------------------------------------- */
/* START                                                */
/* ---------------------------------------------------- */

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on ${PORT}`);
});
