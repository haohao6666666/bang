import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startApi } from "./index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientRoot = path.join(root, "dist", "client");
const host = process.env.JIXIANG_BIND_HOST || "0.0.0.0";
const port = Number(process.env.PORT || 4173);
const apiPort = Number(process.env.API_PORT || (port === 4173 ? 4175 : port + 2));

if (!existsSync(path.join(clientRoot, "index.html"))) {
  throw new Error("没有找到 dist/client/index.html，请先运行 npm run build。");
}

try { process.loadEnvFile(path.join(root, ".env")); } catch (error) { if (error.code !== "ENOENT") throw error; }
const api = await startApi({ port: apiPort, host, allowLan: true });

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
};

function safeClientPath(requestPath) {
  let decoded;
  try { decoded = decodeURIComponent(new URL(requestPath, "http://localhost").pathname); } catch { return null; }
  const relative = decoded.replace(/^\/+/, "");
  const candidate = path.resolve(clientRoot, relative);
  return candidate === clientRoot || candidate.startsWith(`${clientRoot}${path.sep}`) ? candidate : null;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url?.startsWith("/api/")) {
      const upstream = await fetch(`http://127.0.0.1:${apiPort}${req.url}`, {
        method: req.method,
        headers: req.headers,
        body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
        duplex: "half",
      });
      res.writeHead(upstream.status, Object.fromEntries(upstream.headers));
      if (upstream.body) Readable.fromWeb(upstream.body).pipe(res);
      else res.end();
      return;
    }

    const direct = safeClientPath(req.url || "/");
    const filePath = direct && existsSync(direct) && statSync(direct).isFile()
      ? direct
      : path.join(clientRoot, "index.html");
    if (!existsSync(filePath)) { res.writeHead(404); res.end("Not found"); return; }
    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "Cache-Control": extension === ".html" || extension === ".webmanifest" ? "no-cache" : "public,max-age=31536000,immutable",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(filePath).pipe(res);
  } catch {
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("迹向本机服务暂时不可用。");
  }
});

server.listen(port, host, () => {
  console.log(`迹向手机应用: http://127.0.0.1:${port}`);
  console.log(`局域网访问已启用；API 仅接受本机或同一局域网请求（端口 ${apiPort}）。`);
});

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, async () => {
  server.close();
  api.close();
  process.exit(0);
});
