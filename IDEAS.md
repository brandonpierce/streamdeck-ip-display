# Feature Ideas

This document contains potential feature enhancements for the Stream Deck IP Display plugin.

## High-Value, Easy Additions

### 1. Copy to Clipboard
Long-press to copy current IP(s) to clipboard for easy sharing/pasting.

### 2. Network Interface Selection
Currently picks first non-internal interface; let users choose specific adapter (WiFi vs Ethernet vs VPN) via property inspector dropdown.

### 3. WiFi Network Name (SSID)
Display network name alongside local IP, especially useful when switching between networks.

### 4. Better Error States
More specific visual indicators for different failures:
- No internet connection
- API timeout
- No network adapter
- Rate limit exceeded

### 5. Custom Label Text
Let users rename "LOCAL IP" / "PUBLIC IP" labels (e.g., "LAN", "WAN", "Server IP").

## Medium-Value, Moderate Complexity

### 6. IPv6 Support
Toggle between IPv4/IPv6 or show both (increasingly relevant as IPv6 adoption grows).

### 7. IP Change Detection
Visual alert or color flash when IP changes, useful for dynamic IP monitoring.

### 8. VPN Status Indicator
Detect VPN connection and show different status color/icon.

### 9. QR Code Display Mode
Convert IP to QR code for easy mobile device connection (useful for local servers/sharing).

### 10. Hostname Display
Show computer hostname alongside or instead of IP.

## Advanced Features

### 11. Connection Quality
Show ping latency to configurable host (gateway, 8.8.8.8, custom).

### 12. Multi-IP Support
For users with multiple interfaces, show all active IPs in a scrollable/cyclable view.

### 13. IP History/Log
Track IP changes over time, export to file.

### 14. Custom API Endpoint
Let users specify their own public IP service (privacy/reliability).

## Recommended Starting Points

The most impactful features to implement first would be:
1. **Copy to Clipboard** - High user value, straightforward implementation
2. **Network Interface Selection** - Solves common multi-adapter scenarios
