import { createAdapter } from "@socket.io/redis-adapter";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import http from "http";
import { createClient } from "redis";
import { Server } from "socket.io";

const app = express();
app.use(cors());
app.use(helmet());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || "redis";
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const pubClient = createClient({ url: `redis://${REDIS_HOST}:${REDIS_PORT}` });
const subClient = pubClient.duplicate();

await pubClient.connect();
await subClient.connect();

io.adapter(createAdapter(pubClient, subClient));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

io.on("connection", (socket) => {
  console.log("🟢 connected:", socket.id);

  socket.on("message", (msg) => {
    io.emit("message", msg);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
