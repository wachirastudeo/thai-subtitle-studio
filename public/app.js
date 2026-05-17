const form = document.querySelector("#form");
const media = document.querySelector("#media");
const fileName = document.querySelector("#fileName");
const statusEl = document.querySelector("#status");
const subtitle = document.querySelector("#subtitle");
const copyBtn = document.querySelector("#copy");
const downloadBtn = document.querySelector("#download");
const submitBtn = document.querySelector("#submit");
const progressCard = document.querySelector("#progressCard");
const progressBar = document.querySelector("#progressBar");
const progressLabel = document.querySelector("#progressLabel");
const progressValue = document.querySelector("#progressValue");
const progressDetail = document.querySelector("#progressDetail");

let currentFormat = "srt";
let elapsedTimer;
let pollTimer;
let startedAt;

function setProgress(value, label, detail) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  progressCard.hidden = false;
  progressBar.style.width = `${safeValue}%`;
  progressValue.textContent = `${safeValue}%`;
  if (label) progressLabel.textContent = label;
  if (detail) progressDetail.textContent = detail;
}

function startElapsedClock() {
  clearInterval(elapsedTimer);
  startedAt = Date.now();
  elapsedTimer = setInterval(() => {
    const seconds = Math.floor((Date.now() - startedAt) / 1000);
    const current = progressDetail.dataset.base || progressDetail.textContent || "กำลังทำงาน";
    progressDetail.textContent = `${current} • ${seconds}s`;
  }, 1000);
}

function finishProgress(label) {
  clearInterval(elapsedTimer);
  clearInterval(pollTimer);
  setProgress(100, label);
}

function resetProgress() {
  clearInterval(elapsedTimer);
  clearInterval(pollTimer);
  progressBar.style.width = "0%";
  progressValue.textContent = "0%";
  progressLabel.textContent = "เตรียมไฟล์";
  progressDetail.textContent = "รอเริ่มงาน";
  progressDetail.dataset.base = "";
  progressCard.hidden = true;
}

function uploadJob(data) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/transcribe");
    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        setProgress(8, "อัปโหลดไฟล์", "กำลังส่งไฟล์เข้า server");
        return;
      }
      const uploadProgress = Math.min(25, (event.loaded / event.total) * 25);
      setProgress(uploadProgress, "อัปโหลดไฟล์", `${Math.round(event.loaded / 1024 / 1024)} MB / ${Math.round(event.total / 1024 / 1024)} MB`);
    });
    xhr.addEventListener("load", () => {
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status >= 400) reject(new Error(`${result.error}\n${result.detail || ""}`.trim()));
        else resolve(result.jobId);
      } catch (error) {
        reject(error);
      }
    });
    xhr.addEventListener("error", () => reject(new Error("อัปโหลดไม่สำเร็จ")));
    xhr.send(data);
  });
}

async function pollJob(jobId) {
  const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);
  const job = await response.json();
  if (!response.ok) throw new Error(job.error || "อ่านสถานะไม่สำเร็จ");

  const detail = job.detail || "กำลังทำงาน";
  progressDetail.dataset.base = detail;
  setProgress(job.progress || 30, job.label || "กำลังทำงาน", detail);
  statusEl.textContent = job.label || "กำลังทำงาน";

  if (job.state === "done") {
    subtitle.value = job.result.subtitle;
    currentFormat = job.result.format || currentFormat;
    statusEl.textContent = `เสร็จแล้ว: ${job.result.language || "auto"}`;
    finishProgress("เสร็จแล้ว");
    copyBtn.disabled = false;
    downloadBtn.disabled = false;
    submitBtn.disabled = false;
    return true;
  }

  if (job.state === "error") {
    throw new Error(`${job.error || "ถอดเสียงไม่สำเร็จ"}\n${job.detail || ""}`.trim());
  }

  return false;
}

media.addEventListener("change", () => {
  fileName.textContent = media.files[0]?.name || "เลือกหรือลากไฟล์เสียง/วิดีโอ";
  resetProgress();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!media.files[0]) return;

  const data = new FormData(form);
  currentFormat = data.get("format") || "srt";
  subtitle.value = "";
  submitBtn.disabled = true;
  copyBtn.disabled = true;
  downloadBtn.disabled = true;
  statusEl.textContent = "อัปโหลดไฟล์";
  setProgress(2, "เตรียมไฟล์", "กำลังเริ่มอัปโหลด");
  startElapsedClock();

  try {
    const jobId = await uploadJob(data);
    setProgress(28, "รับไฟล์แล้ว", "รอ Whisper เริ่มทำงาน");
    const done = await pollJob(jobId);
    if (done) return;
    pollTimer = setInterval(async () => {
      try {
        const jobDone = await pollJob(jobId);
        if (jobDone) clearInterval(pollTimer);
      } catch (error) {
        clearInterval(pollTimer);
        statusEl.textContent = "ไม่สำเร็จ";
        finishProgress("ไม่สำเร็จ");
        subtitle.value = error.message;
        submitBtn.disabled = false;
      }
    }, 1000);
  } catch (error) {
    statusEl.textContent = "ไม่สำเร็จ";
    finishProgress("ไม่สำเร็จ");
    subtitle.value = error.message;
    submitBtn.disabled = false;
  }
});

copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(subtitle.value);
  statusEl.textContent = "คัดลอกแล้ว";
});

downloadBtn.addEventListener("click", () => {
  const blob = new Blob([subtitle.value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `subtitle.${currentFormat}`;
  a.click();
  URL.revokeObjectURL(url);
});
