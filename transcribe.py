import argparse
import json
import re
from pathlib import Path


def ts(seconds: float, sep: str = ",") -> str:
    ms = int(round(max(seconds, 0) * 1000))
    h, rem = divmod(ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, milli = divmod(rem, 1000)
    return f"{h:02}:{m:02}:{s:02}{sep}{milli:03}"


def tokenize(text: str) -> list[str]:
    try:
        from pythainlp.tokenize import word_tokenize

        tokens = []
        for part in re.findall(r"[\u0E00-\u0E7F]+|[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?|[^\s]", text):
            if re.fullmatch(r"[\u0E00-\u0E7F]+", part):
                tokens.extend(word_tokenize(part, engine="newmm"))
            else:
                tokens.append(part)
        return [t for t in tokens if t.strip()]
    except Exception:
        return re.findall(r"[\u0E00-\u0E7F]+|[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?|[^\s]", text)


def join_tokens(tokens: list[str]) -> str:
    out = ""
    for token in tokens:
        if not out:
            out = token
        elif re.match(r"[A-Za-z0-9]", token) and re.search(r"[A-Za-z0-9]$", out):
            out += " " + token
        elif re.match(r"[,.;:!?)]", token):
            out += token
        elif re.match(r"[(]", token):
            out += " " + token
        elif re.match(r"[A-Za-z0-9]", token) and re.search(r"[\u0E00-\u0E7F]$", out):
            out += " " + token
        elif re.match(r"[\u0E00-\u0E7F]", token) and re.search(r"[A-Za-z0-9]$", out):
            out += " " + token
        else:
            out += token
    return out.strip()


def split_text(text: str, max_chars: int) -> list[str]:
    tokens = tokenize(re.sub(r"\s+", " ", text).strip())
    chunks, current = [], []
    for token in tokens:
        candidate = join_tokens(current + [token])
        if current and len(candidate) > max_chars:
            chunks.append(join_tokens(current))
            current = [token]
        else:
            current.append(token)
    if current:
        chunks.append(join_tokens(current))
    return chunks or [text.strip()]


def make_cues(segments: list[dict], max_chars: int) -> list[dict]:
    cues = []
    for seg in segments:
        text = seg.get("text", "").strip()
        if not text:
            continue
        chunks = split_text(text, max_chars)
        start, end = float(seg["start"]), float(seg["end"])
        span = max(end - start, 0.1)
        total = sum(max(len(c), 1) for c in chunks)
        cursor = start
        for chunk in chunks:
            ratio = max(len(chunk), 1) / total
            next_time = end if chunk == chunks[-1] else cursor + span * ratio
            cues.append({"start": cursor, "end": next_time, "text": chunk})
            cursor = next_time
    return cues


def render_srt(cues: list[dict]) -> str:
    blocks = []
    for i, cue in enumerate(cues, 1):
        blocks.append(f"{i}\n{ts(cue['start'])} --> {ts(cue['end'])}\n{cue['text']}")
    return "\n\n".join(blocks) + "\n"


def render_vtt(cues: list[dict]) -> str:
    lines = ["WEBVTT", ""]
    for cue in cues:
        lines.append(f"{ts(cue['start'], '.')} --> {ts(cue['end'], '.')}")
        lines.append(cue["text"])
        lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--language", default="auto")
    parser.add_argument("--model", default="small")
    parser.add_argument("--max-chars", type=int, default=38)
    parser.add_argument("--format", choices=["srt", "vtt"], default="srt")
    args = parser.parse_args()

    try:
        import whisper
    except Exception as exc:
        raise SystemExit(
            "ต้องติดตั้งฟรีก่อน: python3 -m pip install -U openai-whisper\n"
            f"import error: {exc}"
        )

    model = whisper.load_model(args.model)
    language = None if args.language == "auto" else args.language
    result = model.transcribe(str(Path(args.input)), language=language, fp16=False, verbose=False)
    cues = make_cues(result.get("segments", []), args.max_chars)
    subtitle = render_vtt(cues) if args.format == "vtt" else render_srt(cues)

    Path(args.output).write_text(
        json.dumps(
            {
                "language": result.get("language"),
                "format": args.format,
                "subtitle": subtitle,
                "cues": cues,
            },
            ensure_ascii=False,
        ),
        encoding="utf8",
    )


if __name__ == "__main__":
    main()
