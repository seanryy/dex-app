# Dex

Your personal knowledge system. Notes, tasks, meetings, AI chat, and agents — all in one place.

## Setup

```bash
git clone https://github.com/seanryy/dex-app.git
cd dex-app
npm install
npm run dev
```

Requires [Node.js](https://nodejs.org/) 20+ and Xcode Command Line Tools (`xcode-select --install`) for native modules.

Once the app is running, open **Settings** (`Cmd+6`) and:

1. **Set your Vault location** — point Dex to a folder of markdown files (notes, tasks, meetings, etc.)
2. **Add your Claude API key** — get one from [console.anthropic.com](https://console.anthropic.com/) (required for Chat and Agents)
3. **Configure MCP servers** *(optional)* — add a `.mcp.json` file in your vault root to connect external tools

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
