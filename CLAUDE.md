# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Stream Deck plugin that displays IP addresses on Stream Deck buttons. It shows both local and public IP addresses with visual status indicators using Canvas-based rendering for pixel-perfect display.

## Development Commands

```bash
# Build the plugin
npm run build

# Build and watch for changes (auto-restarts Stream Deck plugin)
npm run watch

# Manual Stream Deck operations (requires Elgato CLI)
streamdeck restart io.piercefamily.ip-display
streamdeck link
streamdeck dev
```

## Architecture

### Plugin Structure
- **`src/plugin.ts`** - Main plugin entry point that registers actions and connects to Stream Deck
- **`src/actions/local-ip-display.ts`** - Core IP display action implementation
- **`io.piercefamily.ip-display.sdPlugin/`** - Stream Deck plugin directory with manifest, assets, and built code

### Key Patterns

**Action Registration**: Uses `@action()` decorator with UUID matching manifest.json:
```typescript
@action({ UUID: "io.piercefamily.ip-display.dual-ip" })
export class IPDisplay extends SingletonAction<IPSettings>
```

**Canvas Rendering**: All visual output uses Canvas instead of text to avoid truncation issues:
- 144x144 pixel resolution for Stream Deck buttons
- Text shadows for readability on transparent backgrounds
- Base64 data URI conversion for Stream Deck compatibility

**IP Address Handling**:
- Local IP: Uses `os.networkInterfaces()` to find non-internal IPv4 addresses
- Public IP: Fetches from ipify.org API with 5-minute caching to avoid rate limits
- Status indicator: Color-coded dot (green/orange/red) based on connection status

### Build Process

The build uses Rollup with specific Stream Deck requirements:
- **External dependencies**: Canvas is marked external and installed separately in plugin directory
- **Output**: Bundles to `io.piercefamily.ip-display.sdPlugin/bin/plugin.js`
- **Module type**: Emits ES modules with package.json type declaration
- **Watch mode**: Automatically restarts Stream Deck plugin on changes

### Stream Deck Integration

**Manifest Configuration** (`io.piercefamily.ip-display.sdPlugin/manifest.json`):
- Defines plugin metadata, actions, and Node.js requirements
- Action UUIDs must match decorator in TypeScript code
- Supports both macOS 12+ and Windows 10+

**Event Handling**:
- `onWillAppear`: Renders IP display when button appears
- `onKeyDown`: Refreshes IP addresses when button is pressed

### Dependencies

**Runtime**:
- `@elgato/streamdeck`: Official Stream Deck SDK v1.0.0
- `canvas`: For pixel-perfect text rendering (installed in plugin directory)

**Development**:
- `@elgato/cli`: Stream Deck development tools
- Rollup + TypeScript build pipeline
- Node.js 20 target configuration

## Important Notes

- Canvas dependency requires separate installation in plugin directory due to native bindings
- IP address caching prevents API rate limiting (5-minute intervals)
- Text shadows are essential for readability on transparent Stream Deck buttons
- Plugin auto-restarts during development when using `npm run watch`