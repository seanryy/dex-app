# Dex App

Desktop interface for [Dex](https://github.com/davekilleen/dex) — your AI Chief of Staff. A native app that puts your vault, AI chat, agents, and quick capture in one window.

## Prerequisites

1. **Set up Dex first** — follow the [main Dex repo](https://github.com/davekilleen/dex) instructions to clone the vault, run `/setup`, and configure your role
2. **Get a Claude API key** — from [console.anthropic.com](https://console.anthropic.com/)
3. **Node.js 20+** — [download here](https://nodejs.org/)
4. **Xcode Command Line Tools** (macOS) — `xcode-select --install`

## Setup

```bash
git clone https://github.com/seanryy/dex-app.git
cd dex-app
npm install
npm run dev
```

Once the app opens, go to **Settings** (`Cmd+6`) and:

1. **Set your Vault location** — point to your Dex vault folder
2. **Add your Claude API key** — paste your key from Anthropic
3. **Configure MCP servers** *(optional)* — reads `.mcp.json` from your vault root

## Build

```bash
npm run dist:mac    # .dmg + .zip
npm run dist:win    # .exe installer
npm run dist:linux  # .AppImage + .deb
```

## Shortcuts

| Shortcut                   | Action              |
| -------------------------- | ------------------- |
| `Cmd + Shift + Space`      | Quick Capture       |
| `Cmd + Shift + D`          | Toggle window       |
| `Cmd + K`                  | Command palette     |
| `Cmd + S`                  | Save (Vault editor) |
| `Enter`                    | Save (Quick Capture)|

## License

MIT License. 
