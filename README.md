# Stream Deck IP Display Plugin

A Stream Deck plugin that displays your local and public IP addresses on a customizable button with real-time status indicators.

## Features

- **Dual IP Display**: Shows both local network IP and public internet IP on a single button
- **Visual Status Indicator**: Color-coded connection status dot
  - 🟢 Green: Both local and public IPs detected
  - 🟠 Orange: Only one IP detected
  - 🔴 Red: No connection detected
- **Transparent Background**: Clean design that works with any Stream Deck theme
- **Auto-Refresh**: Press the button to manually refresh IP addresses
- **Smart Caching**: Public IP is cached for 5 minutes to prevent API rate limiting
- **High-Quality Rendering**: Canvas-based text rendering prevents truncation issues

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

1. Open Stream Deck software
2. Drag the "Dual IP Display" action to any button
3. The button will automatically display your current IP addresses
4. Press the button to refresh the IP information

### Button Layout
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
│   ├── plugin.ts                 # Main plugin entry point
│   └── actions/
│       └── local-ip-display.ts   # IP display action implementation
├── io.piercefamily.ip-display.sdPlugin/
│   ├── manifest.json             # Plugin configuration
│   ├── imgs/                     # Plugin icons and assets
│   └── bin/                      # Built plugin code
├── package.json                  # Dependencies and scripts
├── rollup.config.mjs            # Build configuration
└── tsconfig.json                # TypeScript configuration
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