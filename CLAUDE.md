# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Stream Deck plugin that displays IP addresses on Stream Deck buttons with configurable auto-refresh functionality. It offers four button types: Dual IP Display (both local and public), Local IP Only, Public IP Only, and IP Toggle Display (cycles between modes). Features Canvas-based rendering for pixel-perfect display and user-configurable refresh intervals via property inspector UI.

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
- **`src/plugin.ts`** - Main plugin entry point that registers all actions and connects to Stream Deck
- **`src/actions/local-ip-display.ts`** - Dual IP display action (shows both local and public IP)
- **`src/actions/local-ip-only-display.ts`** - Local IP only display action
- **`src/actions/public-ip-only-display.ts`** - Public IP only display action
- **`src/actions/ip-toggle-display.ts`** - Toggle IP display action (cycles between modes)
- **`io.piercefamily.ip-display.sdPlugin/`** - Stream Deck plugin directory with manifest, assets, and built code
- **`io.piercefamily.ip-display.sdPlugin/ui/`** - Property inspector HTML files for settings configuration

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
- `onWillAppear`: Renders IP display when button appears and starts auto-refresh timer
- `onKeyDown`: Manual refresh with cache bypass for immediate update
- `onWillDisappear`: Cleans up timer when button is removed from view
- `onDidReceiveSettings`: Restarts timer when user changes refresh interval

**Auto-Refresh System**:
- Timer-based refresh with configurable intervals (default 10 minutes)
- Efficient single timer per action type, supports multiple instances
- Manual refresh bypasses cache, automatic refresh respects cache
- Settings-driven: 0 = Manual Only, >0 = auto-refresh interval in milliseconds

**Property Inspector Integration**:
- HTML-based settings UI using sdpi-components library
- Dropdown selection for refresh intervals (Manual Only, 1min-1hr)
- Settings persistence via Stream Deck SDK
- Separate UI files for different action types

### Timer Management Patterns

**Lifecycle Management**:
```typescript
private refreshTimer: NodeJS.Timeout | null = null;
private visibleActions = new Map<string, WillAppearEvent<Settings>>();

// Start timer on appearance
override async onWillAppear(ev: WillAppearEvent<Settings>) {
    this.visibleActions.set(ev.action.id, ev);
    this.startRefreshTimer(ev.payload.settings);
}

// Clean up on disappearance
override onWillDisappear(ev: WillDisappearEvent<Settings>) {
    this.visibleActions.delete(ev.action.id);
    if (this.visibleActions.size === 0 && this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
    }
}
```

**Settings Management**:
- `IPSettings` type includes `refreshInterval?: number` property
- Default interval: 600000ms (10 minutes)
- Property inspector UI updates settings via Stream Deck SDK
- `onDidReceiveSettings` event restarts timer with new interval

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
- IP address caching prevents API rate limiting (5-minute intervals for public IP)
- Auto-refresh timers are efficiently managed with single timer per action type
- Manual button press bypasses cache for immediate refresh, auto-refresh respects cache
- Property inspector settings persist across Stream Deck restarts
- Text shadows are essential for readability on transparent Stream Deck buttons
- Plugin auto-restarts during development when using `npm run watch`
- Timer cleanup is critical in `onWillDisappear` to prevent memory leaks