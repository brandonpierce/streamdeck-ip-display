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
- **Multi-line Display Mode**: Toggle to split IPs across two lines with larger fonts for better readability

### User Customization
- **Custom Label Text**: Personalize "LOCAL IP" and "PUBLIC IP" labels (max 12 characters)
  - Examples: "LAN", "WAN", "Server IP", "VPN", "Office", "Home"
- **Network Interface Selection**: Choose specific network adapter (WiFi, Ethernet, VPN)
  - Auto-detect picks first available (default)
  - Override to select specific adapter for multi-network setups
- **Clipboard Copy**: Long-press (800ms) any button to copy IP address(es) to clipboard
  - Visual feedback with success/failure indicators
  - Dual IP buttons copy both addresses comma-separated
- **Custom Colors**: Personalize label and IP address colors
  - Choose any color for label text (default: silver)
  - Choose any color for IP addresses (default: white)
  - Color picker available in property inspector for all button types

### Smart Features
- **Settings Persistence**: All preferences saved across Stream Deck restarts
- **API Rate Limiting**: Public IP cached for 5 minutes to prevent excessive API calls
- **Multiple Instance Support**: Each button can have different settings independently

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

Select any IP Display button in Stream Deck software to access the property inspector (right panel).

### Available Settings

#### Custom Labels (Dual IP and Toggle only)
- **Local IP Label**: Rename "LOCAL IP" (max 12 characters)
- **Public IP Label**: Rename "PUBLIC IP" (max 12 characters)
- Leave blank to use defaults
- Examples: "LAN", "WAN", "Server", "VPN", "Office"

#### Custom Label (Single IP actions)
- **Custom Label**: Rename "LOCAL IP" or "PUBLIC IP" (max 12 characters)
- Leave blank to use default
- Examples: "My IP", "Server", "Home", "Work"

#### Network Interface
- **Auto-detect (default)**: Automatically selects first available interface
- **Specific Interface**: Choose from dropdown (WiFi, Ethernet, VPN, etc.)
- Dropdown populates dynamically based on your system's network adapters
- Only interfaces with active IPv4 addresses are shown

#### IP Display Format
- **Single-line (default)**: Traditional compact layout
- **Multi-line**: Split IP addresses across two lines with larger fonts
- Improves readability for longer IP addresses
- Automatically adjusts spacing to prevent edge clipping

#### Custom Colors (All actions)
- **Label Color**: Choose custom color for label text
- **IP Address Color**: Choose custom color for IP addresses
- Defaults: Silver labels, White IP addresses
- Colors update immediately on change

#### Auto Refresh Interval
- **Manual Only**: No automatic refresh (refresh only on button press)
- **1 minute**: Fast refresh for dynamic environments
- **5 minutes**: Balanced refresh rate
- **10 minutes (default)**: Recommended for most users
- **30 minutes**: Low-frequency monitoring
- **1 hour**: Minimal refresh for stable networks

### Button Interactions

#### Short Press (< 800ms)
- **Single/Dual IP**: Refreshes IP addresses (bypasses cache)
- **Toggle IP**: Cycles to next mode (Dual → Local → Public → Dual) and refreshes

#### Long Press (≥ 800ms)
- **All Buttons**: Copies IP address(es) to clipboard
  - Single IP: Copies just the IP address
  - Dual IP: Copies both comma-separated: `192.168.1.100,203.0.113.45`
  - Visual feedback: ✓ success or ✗ failure

### Settings Persistence
All configuration options persist across Stream Deck restarts automatically.

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

### Clipboard Copy Not Working
- Ensure press duration exceeds 800ms for long-press detection
- Check system clipboard permissions (some apps may block clipboard access)
- Try a short press first to ensure button is responsive
- Watch for visual feedback (✓ or ✗) to confirm copy attempt

### Network Interface Dropdown Empty
- Ensure you have at least one active network connection
- Only interfaces with IPv4 addresses appear in dropdown
- Disconnect and reconnect to network, then open property inspector again
- Try "Auto-detect (default)" if specific interface not showing

### Multi-line Display Text Cut Off
- Font sizes auto-adjust to prevent edge clipping
- If IPs still appear cut off, report the specific IP format (issue)
- Try single-line mode as alternative
- Custom labels over 12 characters will be truncated

### Custom Labels Not Showing
- Check that you entered text in the property inspector field
- Labels update on next refresh - press button to force update
- Blank fields reset to default "LOCAL IP" / "PUBLIC IP"
- Maximum 12 characters - longer text will be cut off

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
- Property inspector UI powered by [SDPI Components](https://sdpi-components.dev/)
- Public IP detection powered by [ipify.org](https://www.ipify.org/)
- Canvas rendering for high-quality text display