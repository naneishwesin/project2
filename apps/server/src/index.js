import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static("public"));

/* ---- In-memory data ---- */

const servers = {
  s1: {
    id: "s1",
    name: "Demo Server",
    channels: {
      c1: { id: "c1", name: "general", messages: [] },
      c2: { id: "c2", name: "random", messages: [] }
    }
  }
};

/* ---- API ---- */

app.post("/api/login", (req, res) => {
  res.json({ user: { username: req.body.username } });
});

app.get("/api/servers", (req, res) => {
  res.json(Object.values(servers));
});

app.get("/api/servers/:sid/channels", (req, res) => {
  const server = servers[req.params.sid];
  res.json(Object.values(server.channels));
});

/* ---- Socket ---- */

io.on("connection", socket => {
  socket.on("join", ({ channelId, username }) => {
    socket.username = username;
    socket.join(channelId);

    const channel = Object.values(servers.s1.channels)
      .find(c => c.id === channelId);

    socket.emit("messages", channel.messages);
  });

  socket.on("send", ({ channelId, text }) => {
    const msg = { user: socket.username, text };
    servers.s1.channels[channelId].messages.push(msg);
    io.to(channelId).emit("message", msg);
  });
});

server.listen(3000, () =>
  console.log("✅ http://localhost:3000")
);
