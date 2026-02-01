import fs from "fs";
import http from "http";
import mime from "mime";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3001;
const root = path.resolve(__dirname, "..", "public");

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const filePath = path.join(root, urlPath === "/" ? "/index.html" : urlPath);

  if (!filePath.startsWith(root)) {
    res.writeHead(400);
    res.end("bad request");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.setHeader("Content-Type", mime.getType(filePath) || "application/octet-stream");
    res.writeHead(200);
    res.end(data);
  });
});

function listen(port) {
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`web listening on http://localhost:${port}`);
  });
}

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    // eslint-disable-next-line no-console
    console.error(`Port ${PORT} is already in use. Free it with: lsof -ti:${PORT} | xargs kill -9`);
    process.exit(1);
  }
  throw err;
});

listen(PORT);

