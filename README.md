# Thai Subtitle Studio

Local speech-to-text subtitle maker for Thai and English. It runs Whisper locally and exports SRT/VTT.

## Requirements

- Node.js 20+
- Python 3.10+
- ffmpeg

## macOS / Linux

```bash
chmod +x setup-mac-linux.sh run-mac-linux.sh
./setup-mac-linux.sh
./run-mac-linux.sh
```

Open:

```text
http://127.0.0.1:5173
```

## Windows PowerShell

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\setup-windows.ps1
.\run-windows.ps1
```

Open:

```text
http://127.0.0.1:5173
```

## ffmpeg install

macOS:

```bash
brew install ffmpeg
```

Windows:

```powershell
winget install Gyan.FFmpeg
```

Ubuntu/Debian:

```bash
sudo apt install ffmpeg
```

## Model guide

- `small`: balanced, lighter
- `medium`: more accurate
- `turbo`: fast and accurate
- `large-v3`: most accurate, slower and heavier

First run may take longer because Whisper downloads the selected model.
