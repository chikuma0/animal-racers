// Local-only evidence sink. Never started by the app or deployed to Vercel.
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const origin = "http://localhost:3013",
  directory = resolve("docs/production/evidence");
await mkdir(directory, { recursive: true });
const server = createServer(async (req, res) => {
  if (req.headers.origin !== origin) {
    res.writeHead(403);
    res.end();
    return;
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-Capture-Name");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== "POST" || req.url !== "/capture") {
    res.writeHead(404);
    res.end();
    return;
  }
  const name = String(req.headers["x-capture-name"] ?? "");
  if (!/^animal-racers-[a-z0-9-]+\.(png|webm|mp4|json)$/.test(name)) {
    res.writeHead(400);
    res.end();
    return;
  }
  let size = 0;
  const chunks = [];
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 100 * 1024 * 1024) {
        res.writeHead(413);
        res.end();
        return;
      }
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    const path = resolve(directory, name);
    await writeFile(path, bytes, { flag: "wx" });
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    console.log(JSON.stringify({ name, bytes: size, sha256 }));
    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ name, bytes: size, sha256 }));
  } catch {
    res.writeHead(500);
    res.end();
  }
});
server.listen(3014, "127.0.0.1", () =>
  console.log(
    "Local evidence sink http://127.0.0.1:3014; accepts only localhost:3013 origin. Ctrl-C closes it.",
  ),
);
