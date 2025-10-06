# Feature Ideas

This document tracks potential feature enhancements for the Stream Deck IP Display plugin.

## ✅ Implemented Features

### 1. Copy to Clipboard
**Status**: ✅ Implemented (v1.1.0 - 2025-01-06)
Long-press (800ms) any IP display button to copy current IP address(es) to clipboard. Shows success/failure feedback using native Stream Deck icons.

### 2. Network Interface Selection
**Status**: ✅ Implemented (v1.1.0 - 2025-01-06)
Property inspector dropdown allows users to choose specific network adapter (WiFi vs Ethernet vs VPN) with auto-detect as default. Uses SDPI Components datasource pattern for dynamic population.

### 3. Custom Label Text
**Status**: ✅ Implemented (v1.1.0 - 2025-01-06)
Users can rename "LOCAL IP" / "PUBLIC IP" labels (max 12 characters) via property inspector. Supports different labels for each action instance.

### 4. Multi-line IP Display Mode
**Status**: ✅ Implemented (v1.1.0 - 2025-01-06)
Toggle checkbox in property inspector to split IP addresses across two lines with larger fonts for improved readability. Dynamically adjusts layout to prevent edge clipping.

### 5. Custom Symbolic Icons
**Status**: ✅ Implemented (v1.1.0 - 2025-01-06)
Professional custom icons for plugin and all four action types with consistent design language.

## High-Value, Easy Additions

### 1. WiFi Network Name (SSID)
Display network name alongside local IP, especially useful when switching between networks.

### 2. Better Error States
More specific visual indicators for different failures:
- No internet connection
- API timeout
- No network adapter
- Rate limit exceeded

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

## Recommended Next Steps

With the core features now implemented, the most impactful features to add next would be:

### Near-term (High Value)
1. **WiFi Network Name (SSID)** - Helps users identify which network they're on
2. **Better Error States** - More granular feedback for troubleshooting
3. **IP Change Detection** - Visual alerts when IP addresses change

### Mid-term (Nice to Have)
4. **IPv6 Support** - Growing relevance as adoption increases
5. **VPN Status Indicator** - Useful for privacy-conscious users
6. **QR Code Display Mode** - Easy mobile device connection sharing

### Long-term (Advanced)
7. **Connection Quality/Ping** - Network performance monitoring
8. **Custom API Endpoint** - Privacy and reliability options
9. **IP History/Log** - Track changes over time

## New Ideas

### Export/Import Settings
Allow users to export plugin configuration and import on other machines or for backup purposes.

### Keyboard Shortcuts
Quick keyboard combinations for instant clipboard copy without opening Stream Deck software.

### API Health Monitoring
Display status indicator if the public IP API service is down or slow, with automatic fallback to alternative services.

### Compact Display Mode
Ultra-minimalist view showing only IP numbers without labels for users who want maximum screen real estate.
