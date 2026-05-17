import { createServer } from "node:http";
import { existsSync, promises as fs } from "node:fs";
import { extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const root = resolve(".");
const publicDir = join(root, "public");
const workDir = join(root, "work");
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";
const venvPython = process.platform === "win32" ? join(root, ".venv", "Scripts", "python.exe") : join(root, ".venv", "bin", "python");
const pythonCommand = process.env.PYTHON || (existsSync(venvPython) ? venvPython : process.platform === "win32" ? "python" : "python3");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

await fs.mkdir(workDir, { recursive: true });

const jobs = new Map();

function updateJob(jobId, patch) {
  const job = jobs.get(jobId);
  if (!job) return;
  jobs.set(jobId, { ...job, ...patch, updatedAt: Date.now() });
}

function cleanStaleJobs() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [jobId, job] of jobs) {
    if (job.updatedAt < cutoff) jobs.delete(jobId);
  }
}

function readableWhisperDetail(text) {
  if (!text) return "กำลังประมวลผลเสียง";
  if (/\d{1,3}%\|/.test(text) || /\d+(?:\.\d+)?[KMG]\/\d+(?:\.\d+)?[KMG]/i.test(text)) {
    return "กำลังดาวน์โหลดหรือโหลดโมเดล";
  }
  if (/Detected language/i.test(text)) return text.replace(/^Detected language:\s*/i, "ตรวจพบภาษา: ");
  return "กำลังประมวลผลเสียง";
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function json(res, status, body) {
  send(res, status, JSON.stringify(body), { "content-type": "application/json; charset=utf-8" });
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function parseMultipart(buffer, contentType) {
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)?.[2];
  if (!boundary) throw new Error("Missing multipart boundary");
  const marker = Buffer.from(`--${boundary}`);
  const parts = [];
  let cursor = buffer.indexOf(marker) + marker.length + 2;

  while (cursor > marker.length) {
    const next = buffer.indexOf(marker, cursor);
    if (next < 0) break;
    const raw = buffer.subarray(cursor, next - 2);
    const headerEnd = raw.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd > -1) {
      const header = raw.subarray(0, headerEnd).toString("utf8");
      const data = raw.subarray(headerEnd + 4);
      const name = header.match(/name="([^"]+)"/)?.[1];
      const filename = header.match(/filename="([^"]*)"/)?.[1];
      if (name) parts.push({ name, filename, data });
    }
    cursor = next + marker.length + 2;
  }
  return parts;
}

async function handleTranscribe(req, res) {
  try {
    const body = await readBody(req);
    const parts = parseMultipart(body, req.headers["content-type"] || "");
    const file = parts.find((part) => part.name === "media" && part.filename);
    if (!file) return json(res, 400, { error: "ไม่พบไฟล์เสียง/วิดีโอ" });

    const field = (name, fallback) => parts.find((part) => part.name === name)?.data.toString("utf8") || fallback;
    const jobId = randomUUID();
    const safeExt = extname(file.filename).replace(/[^.\w-]/g, "") || ".media";
    const inputPath = join(workDir, `${jobId}${safeExt}`);
    const outputPath = join(workDir, `${jobId}.json`);
    await fs.writeFile(inputPath, file.data);

    jobs.set(jobId, {
      id: jobId,
      state: "running",
      progress: 28,
      label: "รับไฟล์แล้ว กำลังโหลด Whisper",
      detail: "ถ้าใช้ model นี้ครั้งแรก อาจต้องรอดาวน์โหลดโมเดลสักครู่",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const args = [
      "transcribe.py",
      "--input",
      inputPath,
      "--output",
      outputPath,
      "--language",
      field("language", "auto"),
      "--model",
      field("model", "small"),
      "--max-chars",
      field("maxChars", "38"),
      "--format",
      field("format", "srt"),
    ];

    const child = spawn(pythonCommand, args, { cwd: root });
    let stderr = "";
    let bestProgress = 32;
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      const clean = text.replace(/\r/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean).at(-1);
      const match = text.match(/(\d{1,3})%/);
      if (match) {
        bestProgress = Math.max(bestProgress, 40 + Math.min(Number(match[1]), 100) * 0.5);
      } else {
        bestProgress = Math.min(bestProgress + 2, 82);
      }
      updateJob(jobId, {
        progress: Math.round(bestProgress),
        label: bestProgress < 45 ? "กำลังโหลด Whisper" : "Whisper กำลังถอดเสียง",
        detail: readableWhisperDetail(clean),
      });
    });
    child.on("close", async (code) => {
      await fs.rm(inputPath, { force: true });
      if (code !== 0) {
        updateJob(jobId, {
          state: "error",
          progress: 100,
          label: "ถอดเสียงไม่สำเร็จ",
          error: "ถอดเสียงไม่สำเร็จ",
          detail: stderr.trim() || "unknown error",
        });
        return;
      }
      try {
        updateJob(jobId, { progress: 92, label: "จัด timestamp และแบ่งบรรทัด", detail: "กำลังสร้างไฟล์ซับ" });
        const result = JSON.parse(await fs.readFile(outputPath, "utf8"));
        await fs.rm(outputPath, { force: true });
        updateJob(jobId, {
          state: "done",
          progress: 100,
          label: "เสร็จแล้ว",
          detail: `ตรวจพบภาษา: ${result.language || "auto"}`,
          result,
        });
      } catch (error) {
        updateJob(jobId, {
          state: "error",
          progress: 100,
          label: "อ่านผลลัพธ์ไม่สำเร็จ",
          error: "อ่านผลลัพธ์ไม่สำเร็จ",
          detail: error.message,
        });
      }
    });
    cleanStaleJobs();
    json(res, 202, { jobId });
  } catch (error) {
    json(res, 500, { error: "server error", detail: error.message });
  }
}

function handleJobStatus(req, res) {
  const jobId = decodeURIComponent(req.url.split("/").pop() || "");
  const job = jobs.get(jobId);
  if (!job) return json(res, 404, { error: "ไม่พบงานนี้" });
  json(res, 200, job);
}

async function handleStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${port}`);
  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = resolve(publicDir, `.${pathname}`);
  if (!filePath.startsWith(publicDir)) return send(res, 403, "Forbidden");
  try {
    const data = await fs.readFile(filePath);
    send(res, 200, data, { "content-type": mime[extname(filePath)] || "application/octet-stream" });
  } catch {
    send(res, 404, "Not found");
  }
}

createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/transcribe") return handleTranscribe(req, res);
  if (req.method === "GET" && req.url.startsWith("/api/jobs/")) return handleJobStatus(req, res);
  return handleStatic(req, res);
}).listen(port, host, () => {
  console.log(`Thai Subtitle Studio running at http://${host}:${port}`);
});
