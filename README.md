# Thai Subtitle Studio

Local speech-to-text subtitle maker for Thai and English. It runs Whisper locally and exports SRT/VTT.

## Easiest Run

Download or clone this project, then use the file for your OS.

macOS:

```bash
chmod +x start-mac.command setup-mac-linux.sh run-mac-linux.sh
./start-mac.command
```

Windows:

```text
Double-click start-windows.bat
```

Then open:

```text
http://127.0.0.1:5173
```

## Requirements

- Node.js 20+
- Python 3.10+
- ffmpeg

If one is missing, install it first:

macOS:

```bash
brew install node python ffmpeg
```

Windows:

```powershell
winget install OpenJS.NodeJS Python.Python.3.12 Gyan.FFmpeg
```

## macOS / Linux

Manual run:

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

Manual run:

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
