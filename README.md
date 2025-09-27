# Stream Deck IP Display Plugin

A comprehensive Stream Deck plugin for IP address monitoring with four button types and configurable auto-refresh functionality.

## Features

### Four Button Types
- **Dual IP Display**: Shows both local network IP and public internet IP on a single button
- **Local IP Display**: Shows only your local network IP address with centered layout
- **Public IP Display**: Shows only your public internet IP address with centered layout
- **IP Toggle Display**: Cycles between dual, local, and public IP modes on each press

### Automatic Refresh
- **Configurable Auto-Refresh**: Set intervals from 1 minute to 1 hour (default: 10 minutes)
- **Manual Only Mode**: Disable auto-refresh for manual control only
- **Smart Refresh**: Manual button press bypasses cache for immediate updates
- **Efficient Timers**: Single timer per action type with proper lifecycle management

### Visual Design
- **Visual Status Indicator**: Color-coded connection status dot
  - 🟢 Green: IP(s) detected and connected
  - 🔴 Red: No IP connection detected
- **Transparent Background**: Clean design that works with any Stream Deck theme
- **High-Quality Rendering**: Canvas-based text rendering prevents truncation issues
- **Optimized Layouts**: Single IP displays use larger fonts and centered positioning

### Smart Features
- **Settings Persistence**: Auto-refresh preferences saved across Stream Deck restarts
- **API Rate Limiting**: Public IP cached for 5 minutes to prevent excessive API calls
- **Multiple Instance Support**: Each button can have different refresh settings

## Installation

### From Release (Recommended)
1. Download the latest `.streamDeckPlugin` file from the [Releases](../../releases) page
2. Double-click the file to install
3. The plugin will appear in your Stream Deck software

### Manual Installation
1. Clone this repository
2. Run `npm install`
3. Run `npm run build`
4. Copy the `io.piercefamily.ip-display.sdPlugin` folder to your Stream Deck plugins directory:
   - **Windows**: `%APPDATA%\Elgato\StreamDeck\Plugins\`
   - **macOS**: `~/Library/Application Support/com.elgato.StreamDeck/Plugins/`

## Usage

### Adding Actions to Stream Deck
1. Open Stream Deck software
2. Choose from four available IP Display actions:
   - **Dual IP Display**: Shows both local and public IP
   - **Local IP Display**: Shows only local IP
   - **Public IP Display**: Shows only public IP
   - **IP Toggle Display**: Cycles between all modes
3. Drag your chosen action to any button
4. The button will automatically display your current IP addresses
5. Press the button to refresh the IP information or cycle modes (toggle only)

### Button Layouts

**Dual IP Display:**
```
┌─────────────────┐
│    LOCAL IP     │
│  192.168.1.100  │
│                 │
│   PUBLIC IP     │
│  203.0.113.45   │
│       ●         │ ← Status dot
└─────────────────┘
```

**Single IP Display (Local/Public):**
```
┌─────────────────┐
│                 │
│    LOCAL IP     │
│  192.168.1.100  │
│       ●         │ ← Status dot
│                 │
└─────────────────┘
```

## Configuration

### Auto-Refresh Settings
1. Select any IP Display button in Stream Deck software
2. In the property inspector (right panel), configure:
   - **Auto Refresh Interval**: Choose from dropdown
     - Manual Only (no auto-refresh)
     - 1 minute
     - 5 minutes
     - 10 minutes (default)
     - 30 minutes
     - 1 hour

### Refresh Behavior
- **Automatic**: IP addresses refresh at your selected interval
- **Manual**: Press the button anytime for immediate refresh (bypasses cache)
- **Toggle Mode**: Press to cycle modes AND refresh current display
- **Settings**: Persist across Stream Deck restarts

## Requirements

- **Stream Deck Software**: Version 6.5 or later
- **Operating System**:
  - Windows 10 or later
  - macOS 12 or later
- **Internet Connection**: Required for public IP detection

## Development

### Prerequisites
- Node.js 20 or later
- npm
- Stream Deck software
- Elgato Stream Deck Developer CLI (optional but recommended)

### Setup
```bash
# Install dependencies
npm install

# Install Canvas in plugin directory (required for rendering)
cd io.piercefamily.ip-display.sdPlugin
npm install canvas
cd ..

# Build the plugin
npm run build
```

### Development Workflow
```bash
# Watch for changes and auto-restart plugin
npm run watch

# Manual Stream Deck operations
streamdeck restart io.piercefamily.ip-display
streamdeck link
streamdeck dev
```

### Project Structure
```
├── src/
│   ├── plugin.ts                      # Main plugin entry point
│   └── actions/
│       ├── local-ip-display.ts        # Dual IP display action
│       ├── local-ip-only-display.ts   # Local IP only action
│       ├── public-ip-only-display.ts  # Public IP only action
│       └── ip-toggle-display.ts       # Toggle IP display action
├── io.piercefamily.ip-display.sdPlugin/
│   ├── manifest.json                  # Plugin configuration
│   ├── imgs/                          # Plugin icons and assets
│   ├── ui/                            # Property inspector HTML files
│   │   ├── ip-display.html            # Settings UI for single IP actions
│   │   └── ip-toggle.html             # Settings UI for toggle action
│   └── bin/                           # Built plugin code
├── package.json                       # Dependencies and scripts
├── rollup.config.mjs                 # Build configuration
├── tsconfig.json                     # TypeScript configuration
├── CLAUDE.md                         # AI development guidance
└── README.md                         # This file
```

### Key Technologies
- **Stream Deck SDK**: Official Elgato SDK v1.0.0
- **TypeScript**: Type-safe development
- **Canvas**: High-quality text rendering
- **Rollup**: Module bundling
- **Node.js APIs**: Network interface detection

## How It Works

### Local IP Detection
The plugin scans your network interfaces using Node.js `os.networkInterfaces()` to find non-internal IPv4 addresses, typically your router-assigned IP address.

### Public IP Detection
Public IP is fetched from the [ipify.org](https://www.ipify.org/) API, a free and reliable IP detection service. Results are cached for 5 minutes to minimize API calls.

### Canvas Rendering
All text is rendered using HTML5 Canvas to ensure pixel-perfect display and prevent text truncation issues that can occur with Stream Deck's built-in text rendering.

### Auto-Refresh System
The plugin uses configurable timers for automatic IP address updates. Each action type maintains a single efficient timer that refreshes all visible instances. Timer lifecycle is managed through Stream Deck events to prevent memory leaks and ensure clean operation.

## Troubleshooting

### Button Shows "No Local IP"
- Check your network connection
- Ensure you're connected to a router/network (not just cellular)
- VPN connections may affect local IP detection

### Button Shows "No Public IP"
- Check your internet connection
- Firewall or corporate network may block API requests
- Wait a moment and press the button to refresh

### Plugin Not Loading
- Ensure Stream Deck software is version 6.5 or later
- Check that Node.js 20 is installed on your system
- Try restarting Stream Deck software

### Auto-Refresh Not Working
- Check that refresh interval is not set to "Manual Only"
- Verify Stream Deck software is running (timers pause when software closes)
- Try manually refreshing once to reset the timer
- Property inspector settings may take a moment to apply

### Toggle Button Stuck on One Mode
- Right-click the button and check current mode in property inspector
- Press the button to cycle to next mode
- Settings are saved automatically and persist across restarts

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source. Please check the repository for license information.

## Acknowledgments

- Built with the [Elgato Stream Deck SDK](https://github.com/elgatosf/streamdeck)
- Public IP detection powered by [ipify.org](https://www.ipify.org/)
- Canvas rendering for high-quality text display