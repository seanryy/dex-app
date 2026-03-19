# Dex

A desktop app for your personal knowledge system. Dex brings together notes, tasks, meetings, AI chat, autonomous agents, and activity tracking in one place — with a system-wide Quick Capture shortcut so you can save anything without switching context.

Built with Electron, React, Tailwind CSS, and Claude.

## Features

- **Dashboard** — At-a-glance view of tasks, meetings, priorities, activity, and more
- **Vault** — Browse and edit local markdown notes
- **Chat** — Claude-powered AI assistant with conversation history
- **Agents** — Autonomous AI agents that run tasks in the background
- **Quick Capture** — Global shortcut to instantly save notes, tasks, or meetings
- **Activity Feed** — Track what's happening across your system
- **System Tray** — Runs in the background, always accessible

## Prerequisites

- **Node.js** >= 20 (LTS recommended)
- **npm** >= 10
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Windows**: [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with "Desktop development with C++" workload
- **Linux**: `build-essential`, `libasound2-dev`, `libpulse-dev`

Native modules (Picovoice, Whisper) require a C++ toolchain for compilation during `npm install`.

## Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd dex-app

# Install dependencies
npm install

# Start in development mode (with hot reload)
npm run dev
```

The app window will open automatically. Use `Cmd+Shift+Space` (macOS) or `Ctrl+Shift+Space` (Windows/Linux) to open Quick Capture from anywhere.

## Scripts

| Command            | Description                                      |
| ------------------ | ------------------------------------------------ |
| `npm run dev`      | Start the app in development mode with hot reload |
| `npm run build`    | Compile TypeScript and bundle with Vite           |
| `npm run preview`  | Preview the production build locally              |
| `npm run pack`     | Build + package into an unpacked directory         |
| `npm run dist`     | Build + package into distributable installers      |
| `npm run dist:mac` | Build + package for macOS (.dmg, .zip)            |
| `npm run dist:win` | Build + package for Windows (.exe)                |
| `npm run dist:linux` | Build + package for Linux (.AppImage, .deb)     |

## Building Distributable Installers

```bash
# macOS — produces .dmg and .zip in the release/ folder
npm run dist:mac

# Windows — produces .exe installer
npm run dist:win

# Linux — produces .AppImage and .deb
npm run dist:linux

# All platforms (current platform only)
npm run dist
```

Output files are written to the `release/` directory.

### Code Signing (macOS)

For distribution outside your own machine, you'll need to sign and notarize the app. Set these environment variables before building:

```bash
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="your-certificate-password"
export APPLE_ID="your@apple.id"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
```

Without these, the build will produce an unsigned app that works locally but triggers Gatekeeper warnings for other users.

## Keyboard Shortcuts

| Shortcut                      | Action                     |
| ----------------------------- | -------------------------- |
| `Cmd/Ctrl + Shift + Space`    | Open Quick Capture          |
| `Cmd/Ctrl + Shift + D`        | Toggle main window          |
| `Cmd/Ctrl + K`                | Command palette             |
| `Cmd/Ctrl + 1–6`              | Switch views                |
| `Cmd/Ctrl + S`                | Save (in Vault editor)      |
| `Enter`                       | Save (in Quick Capture)     |
| `Tab`                         | Cycle type (in Quick Capture) |
| `Escape`                      | Dismiss Quick Capture       |

## Project Structure

```
dex-app/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts            # App entry, windows, tray, shortcuts
│   │   ├── ipc-handlers.ts     # IPC message handlers
│   │   ├── claude-client.ts    # Anthropic Claude integration
│   │   ├── agent-engine.ts     # Agent execution engine
│   │   ├── vault-reader.ts     # Local markdown vault reader
│   │   ├── mcp-bridge.ts       # MCP protocol bridge
│   │   └── ...
│   ├── preload/        # Preload scripts (context bridge)
│   └── renderer/       # React frontend
│       ├── App.tsx             # Main app shell
│       ├── QuickCaptureApp.tsx # Quick Capture window
│       ├── components/         # UI components
│       └── hooks/              # React hooks
├── build/              # Build resources (icons, entitlements)
├── electron.vite.config.ts
├── electron-builder.yml
└── package.json
```

## Tech Stack

- **Runtime**: [Electron](https://www.electronjs.org/) 33
- **Bundler**: [electron-vite](https://electron-vite.org/) + [Vite](https://vitejs.dev/) 6
- **Frontend**: [React](https://react.dev/) 19, [Tailwind CSS](https://tailwindcss.com/) 4
- **AI**: [Anthropic Claude SDK](https://docs.anthropic.com/), [MCP](https://modelcontextprotocol.io/)
- **Voice**: [Whisper](https://github.com/openai/whisper) (transcription), [Picovoice Porcupine](https://picovoice.ai/) (wake word)
- **Packaging**: [electron-builder](https://www.electron.build/) 25
