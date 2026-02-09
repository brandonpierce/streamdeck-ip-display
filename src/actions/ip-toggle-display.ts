import streamDeck, { action, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent, SendToPluginEvent } from "@elgato/streamdeck";
import { networkInterfaces } from "os";
import { createCanvas } from "canvas";
import clipboard from "clipboardy";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

type ToggleSettings = {
	mode: 'dual' | 'local' | 'public';
	refreshInterval?: number;
	customLocalLabel?: string;
	customPublicLabel?: string;
	multilineIP?: boolean;
	networkInterface?: string;
	labelColor?: string;
	ipColor?: string;
	showWifiSSID?: boolean;
	ssidColor?: string;
};

@action({ UUID: "io.piercefamily.ip-display.toggle" })
export class ToggleIPDisplay extends SingletonAction<ToggleSettings> {
	private refreshTimer: NodeJS.Timeout | null = null;
	private visibleActions = new Map<string, WillAppearEvent<ToggleSettings>>();
	private pressTimers = new Map<string, { timestamp: number, timer: NodeJS.Timeout, localIP: string | null, publicIP: string | null, mode: 'dual' | 'local' | 'public' }>();
	private readonly LONG_PRESS_THRESHOLD = 800; // milliseconds
	private wifiSSIDCache: { ssid: string | null; timestamp: number } = { ssid: null, timestamp: 0 };
	private readonly SSID_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
	override async onWillAppear(ev: WillAppearEvent<ToggleSettings>): Promise<void> {
		// Store this action instance
		this.visibleActions.set(ev.action.id, ev);

		// Get current mode from settings, default to 'dual'
		const { mode = 'dual' } = ev.payload.settings;

		// Display initial content
		const localIP = this.getLocalIPAddress(ev.payload.settings);
		const publicIP = await this.getPublicIPAddress();
		const imageDataUri = await this.generateToggleImage(localIP, publicIP, mode, ev.payload.settings);
		await ev.action.setImage(imageDataUri);

		// Start auto-refresh timer
		this.startRefreshTimer(ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<ToggleSettings>): Promise<void> {
		const pressTime = Date.now();
		const { mode = 'dual' } = ev.payload.settings;
		const localIP = this.getLocalIPAddress(ev.payload.settings);
		const publicIP = await this.getPublicIPAddress();

		// Start long-press timer
		const timer = setTimeout(async () => {
			// Long press detected - copy to clipboard based on current mode
			await this.copyToClipboard(ev, localIP, publicIP, mode);
		}, this.LONG_PRESS_THRESHOLD);

		// Store timer, IPs, and mode for this press
		this.pressTimers.set(ev.action.id, { timestamp: pressTime, timer, localIP, publicIP, mode });
	}

	override async onKeyUp(ev: KeyUpEvent<ToggleSettings>): Promise<void> {
		const pressData = this.pressTimers.get(ev.action.id);
		if (!pressData) return;

		clearTimeout(pressData.timer);
		const duration = Date.now() - pressData.timestamp;

		if (duration < this.LONG_PRESS_THRESHOLD) {
			// Short press - toggle mode
			const { mode = 'dual' } = ev.payload.settings;
			const nextMode = this.getNextMode(mode);

			// Save the new mode (preserve all other settings)
			await ev.action.setSettings({ ...ev.payload.settings, mode: nextMode });

			// Manual refresh - force cache bypass for public IP and SSID
			const localIP = this.getLocalIPAddress(ev.payload.settings);
			this.publicIPCache = { ip: null, timestamp: 0 }; // Clear cache for fresh fetch
			this.wifiSSIDCache = { ssid: null, timestamp: 0 }; // Clear SSID cache too
			const publicIP = await this.getPublicIPAddress();
			const imageDataUri = await this.generateToggleImage(localIP, publicIP, nextMode, ev.payload.settings);
			await ev.action.setImage(imageDataUri);
		}
		// Long press already handled in setTimeout

		this.pressTimers.delete(ev.action.id);
	}

	override onWillDisappear(ev: WillDisappearEvent<ToggleSettings>): void {
		// Remove this action instance
		this.visibleActions.delete(ev.action.id);

		// Clean up press timer if exists
		const pressData = this.pressTimers.get(ev.action.id);
		if (pressData) {
			clearTimeout(pressData.timer);
			this.pressTimers.delete(ev.action.id);
		}

		// If no visible actions remain, stop the timer
		if (this.visibleActions.size === 0 && this.refreshTimer) {
			clearInterval(this.refreshTimer);
			this.refreshTimer = null;
		}
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ToggleSettings>): Promise<void> {
		// Restart timer with new settings
		this.startRefreshTimer(ev.payload.settings);

		// Refresh display with new settings
		const { mode = 'dual' } = ev.payload.settings;
		const localIP = this.getLocalIPAddress(ev.payload.settings);
		const publicIP = await this.getPublicIPAddress();
		const imageDataUri = await this.generateToggleImage(localIP, publicIP, mode, ev.payload.settings);
		await ev.action.setImage(imageDataUri);
	}

	override onSendToPlugin(ev: SendToPluginEvent<any, ToggleSettings>): void {
		const payload = ev.payload as { event?: string };

		if (payload.event === 'getNetworkInterfaces') {
			const nets = networkInterfaces();
			const interfaces: string[] = [];

			for (const name of Object.keys(nets)) {
				const netInterface = nets[name];
				if (!netInterface) continue;

				const hasIPv4 = netInterface.some(net => {
					const familyV4 = typeof net.family === 'string' ? 'IPv4' : 4;
					return net.family === familyV4 && !net.internal;
				});

				if (hasIPv4) {
					interfaces.push(name);
				}
			}

			streamDeck.ui.current?.sendToPropertyInspector({
				event: 'getNetworkInterfaces',
				items: interfaces.map(name => ({
					label: name,
					value: name
				}))
			});
		}
	}

	private splitIP(ip: string | null): { line1: string, line2: string } | null {
		if (!ip) return null;
		const parts = ip.split('.');
		if (parts.length !== 4) return null;
		return {
			line1: `${parts[0]}.${parts[1]}.`,
			line2: `${parts[2]}.${parts[3]}`
		};
	}

	private getNextMode(currentMode: string): 'dual' | 'local' | 'public' {
		switch (currentMode) {
			case 'dual': return 'local';
			case 'local': return 'public';
			case 'public': return 'dual';
			default: return 'dual';
		}
	}

	private async generateToggleImage(localIP: string | null, publicIP: string | null, mode: 'dual' | 'local' | 'public', settings: ToggleSettings): Promise<string> {
		const canvas = createCanvas(144, 144);
		const ctx = canvas.getContext('2d');

		// Text shadow and stroke for readability on transparent background
		ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
		ctx.shadowBlur = 2;
		ctx.shadowOffsetX = 1;
		ctx.shadowOffsetY = 1;

		// Text stroke configuration
		ctx.strokeStyle = 'black';
		ctx.lineWidth = 3;
		ctx.lineJoin = 'round';

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		// Get WiFi SSID if enabled (only for modes that show local IP)
		const showSSID = settings.showWifiSSID !== false; // Default true
		const ssid = (showSSID && (mode === 'dual' || mode === 'local')) ? await this.getWifiSSID() : null;

		if (mode === 'dual') {
			if (settings.multilineIP) {
				// Multiline dual IP display
				const localSplit = this.splitIP(localIP);
				const publicSplit = this.splitIP(publicIP);

				// LOCAL IP Section (Top)
				ctx.fillStyle = settings.labelColor || '#C0C0C0';
				ctx.font = 'bold 13px Arial';
				const localLabel = settings.customLocalLabel || 'LOCAL IP';

				ctx.strokeText(localLabel, 72, 8);
				ctx.fillText(localLabel, 72, 8);

				// SSID below label if available
				if (ssid) {
					ctx.font = '13px Arial';
					ctx.fillStyle = settings.ssidColor || '#999999';
					const truncatedSSID = ssid.length > 18 ? ssid.substring(0, 15) + '...' : ssid;
					ctx.strokeText(truncatedSSID, 72, 26);
					ctx.fillText(truncatedSSID, 72, 26);
				}

				ctx.fillStyle = settings.ipColor || '#FFFFFF';
				ctx.font = 'bold 20px "Courier New", Consolas, monospace';
				const ipStartY = ssid ? 42 : 37;
				if (localSplit) {
					ctx.strokeText(localSplit.line1, 72, ipStartY);
					ctx.fillText(localSplit.line1, 72, ipStartY);
					ctx.strokeText(localSplit.line2, 72, ipStartY + 22);
					ctx.fillText(localSplit.line2, 72, ipStartY + 22);
				} else {
					ctx.strokeText('No Local IP', 72, ipStartY + 8);
					ctx.fillText('No Local IP', 72, ipStartY + 8);
				}

				// PUBLIC IP Section (Bottom - anchored from bottom)
				// Measure text width for dot positioning
				ctx.font = 'bold 13px Arial';
				const publicLabel = settings.customPublicLabel || 'PUBLIC IP';
				const publicLabelMetrics = ctx.measureText(publicLabel);
				const publicDotX = 72 - (publicLabelMetrics.width / 2) - 8;

				// Status indicator dot before label
				if (localIP && publicIP) {
					ctx.fillStyle = '#00FF00'; // Green - both connected
				} else if (localIP || publicIP) {
					ctx.fillStyle = '#FFAA00'; // Orange - partial connection
				} else {
					ctx.fillStyle = '#FF6B6B'; // Red - no connection
				}
				ctx.beginPath();
				ctx.arc(publicDotX, 95, 3, 0, 2 * Math.PI);
				ctx.fill();

				ctx.fillStyle = settings.labelColor || '#C0C0C0';
				ctx.strokeText(publicLabel, 72, 95);
				ctx.fillText(publicLabel, 72, 95);

				ctx.fillStyle = settings.ipColor || '#FFFFFF';
				ctx.font = 'bold 20px "Courier New", Consolas, monospace';
				if (publicSplit) {
					ctx.strokeText(publicSplit.line1, 72, 113);
					ctx.fillText(publicSplit.line1, 72, 113);
					ctx.strokeText(publicSplit.line2, 72, 135);
					ctx.fillText(publicSplit.line2, 72, 135);
				} else {
					ctx.strokeText('No Public IP', 72, 124);
					ctx.fillText('No Public IP', 72, 124);
				}
			} else {
				// Single-line dual IP display
				ctx.fillStyle = settings.labelColor || '#C0C0C0';
				ctx.font = 'bold 14px Arial';
				const localLabel = settings.customLocalLabel || 'LOCAL IP';

				ctx.strokeText(localLabel, 72, 22);
				ctx.fillText(localLabel, 72, 22);

				// SSID below label if available
				if (ssid) {
					ctx.font = '14px Arial';
					ctx.fillStyle = settings.ssidColor || '#999999';
					const truncatedSSID = ssid.length > 18 ? ssid.substring(0, 15) + '...' : ssid;
					ctx.strokeText(truncatedSSID, 72, 40);
					ctx.fillText(truncatedSSID, 72, 40);
				}

				ctx.fillStyle = settings.ipColor || '#FFFFFF';
				ctx.font = 'bold 16px "Courier New", Consolas, monospace';
				const localIPY = ssid ? 56 : 51;
				ctx.strokeText(localIP || 'No Local IP', 72, localIPY);
				ctx.fillText(localIP || 'No Local IP', 72, localIPY);

				// Measure text width for dot positioning
				ctx.font = 'bold 14px Arial';
				const publicLabel = settings.customPublicLabel || 'PUBLIC IP';
				const publicLabelMetrics = ctx.measureText(publicLabel);
				const publicDotX = 72 - (publicLabelMetrics.width / 2) - 8;

				// Status indicator dot before PUBLIC IP label
				if (localIP && publicIP) {
					ctx.fillStyle = '#00FF00'; // Green - both connected
				} else if (localIP || publicIP) {
					ctx.fillStyle = '#FFAA00'; // Orange - partial connection
				} else {
					ctx.fillStyle = '#FF6B6B'; // Red - no connection
				}
				ctx.beginPath();
				ctx.arc(publicDotX, 82, 3, 0, 2 * Math.PI);
				ctx.fill();

				ctx.fillStyle = settings.labelColor || '#C0C0C0';
				ctx.strokeText(publicLabel, 72, 82);
				ctx.fillText(publicLabel, 72, 82);

				ctx.fillStyle = settings.ipColor || '#FFFFFF';
				ctx.font = 'bold 16px "Courier New", Consolas, monospace';
				ctx.strokeText(publicIP || 'No Public IP', 72, 105);
				ctx.fillText(publicIP || 'No Public IP', 72, 105);
			}
		} else if (mode === 'local') {
			if (settings.multilineIP) {
				// Multiline local IP display
				const localSplit = this.splitIP(localIP);

				// Measure text width for dot positioning
				ctx.font = 'bold 16px Arial';
				const localLabel = settings.customLocalLabel || 'LOCAL IP';
				const localLabelMetrics = ctx.measureText(localLabel);
				const localDotX = 72 - (localLabelMetrics.width / 2) - 10;

				// Status indicator dot before label
				ctx.fillStyle = localIP ? '#00FF00' : '#FF6B6B'; // Green if connected, red if not
				ctx.beginPath();
				ctx.arc(localDotX, 28, 4, 0, 2 * Math.PI);
				ctx.fill();

				ctx.fillStyle = settings.labelColor || '#C0C0C0';
				ctx.strokeText(localLabel, 72, 28);
				ctx.fillText(localLabel, 72, 28);

				// SSID below label if available
				if (ssid) {
					ctx.font = '16px Arial';
					ctx.fillStyle = settings.ssidColor || '#999999';
					const truncatedSSID = ssid.length > 20 ? ssid.substring(0, 17) + '...' : ssid;
					ctx.strokeText(truncatedSSID, 72, 48);
					ctx.fillText(truncatedSSID, 72, 48);
				}

				ctx.fillStyle = settings.ipColor || '#FFFFFF';
				ctx.font = 'bold 28px "Courier New", Consolas, monospace';
				if (localSplit) {
					ctx.strokeText(localSplit.line1, 72, 76);
					ctx.fillText(localSplit.line1, 72, 76);
					ctx.strokeText(localSplit.line2, 72, 111);
					ctx.fillText(localSplit.line2, 72, 111);
				} else {
					ctx.strokeText('No Local IP', 72, 87);
					ctx.fillText('No Local IP', 72, 87);
				}
			} else {
				// Single-line local IP display
				// Measure text width for dot positioning
				ctx.font = 'bold 16px Arial';
				const localLabel = settings.customLocalLabel || 'LOCAL IP';
				const localLabelMetrics = ctx.measureText(localLabel);
				const localDotX = 72 - (localLabelMetrics.width / 2) - 10;

				// Status indicator dot before label
				ctx.fillStyle = localIP ? '#00FF00' : '#FF6B6B'; // Green if connected, red if not
				ctx.beginPath();
				ctx.arc(localDotX, 40, 4, 0, 2 * Math.PI);
				ctx.fill();

				ctx.fillStyle = settings.labelColor || '#C0C0C0';
				ctx.strokeText(localLabel, 72, 40);
				ctx.fillText(localLabel, 72, 40);

				// SSID below label if available
				if (ssid) {
					ctx.font = '16px Arial';
					ctx.fillStyle = settings.ssidColor || '#999999';
					const truncatedSSID = ssid.length > 20 ? ssid.substring(0, 17) + '...' : ssid;
					ctx.strokeText(truncatedSSID, 72, 60);
					ctx.fillText(truncatedSSID, 72, 60);
				}

				ctx.fillStyle = settings.ipColor || '#FFFFFF';
				ctx.font = 'bold 18px "Courier New", Consolas, monospace';
				ctx.strokeText(localIP || 'No Local IP', 72, 90);
				ctx.fillText(localIP || 'No Local IP', 72, 90);
			}
		} else {
			if (settings.multilineIP) {
				// Multiline public IP display
				const publicSplit = this.splitIP(publicIP);

				// Measure text width for dot positioning
				ctx.font = 'bold 16px Arial';
				const publicLabel = settings.customPublicLabel || 'PUBLIC IP';
				const publicLabelMetrics = ctx.measureText(publicLabel);
				const publicDotX = 72 - (publicLabelMetrics.width / 2) - 10;

				// Status indicator dot before label
				ctx.fillStyle = publicIP ? '#00FF00' : '#FF6B6B'; // Green if connected, red if not
				ctx.beginPath();
				ctx.arc(publicDotX, 35, 4, 0, 2 * Math.PI);
				ctx.fill();

				ctx.fillStyle = settings.labelColor || '#C0C0C0';
				ctx.strokeText(publicLabel, 72, 35);
				ctx.fillText(publicLabel, 72, 35);

				ctx.fillStyle = settings.ipColor || '#FFFFFF';
				ctx.font = 'bold 28px "Courier New", Consolas, monospace';
				if (publicSplit) {
					ctx.strokeText(publicSplit.line1, 72, 65);
					ctx.fillText(publicSplit.line1, 72, 65);
					ctx.strokeText(publicSplit.line2, 72, 100);
					ctx.fillText(publicSplit.line2, 72, 100);
				} else {
					ctx.strokeText('No Public IP', 72, 82);
					ctx.fillText('No Public IP', 72, 82);
				}
			} else {
				// Single-line public IP display
				// Measure text width for dot positioning
				ctx.font = 'bold 16px Arial';
				const publicLabel = settings.customPublicLabel || 'PUBLIC IP';
				const publicLabelMetrics = ctx.measureText(publicLabel);
				const publicDotX = 72 - (publicLabelMetrics.width / 2) - 10;

				// Status indicator dot before label
				ctx.fillStyle = publicIP ? '#00FF00' : '#FF6B6B'; // Green if connected, red if not
				ctx.beginPath();
				ctx.arc(publicDotX, 48, 4, 0, 2 * Math.PI);
				ctx.fill();

				ctx.fillStyle = settings.labelColor || '#C0C0C0';
				ctx.strokeText(publicLabel, 72, 48);
				ctx.fillText(publicLabel, 72, 48);

				ctx.fillStyle = settings.ipColor || '#FFFFFF';
				ctx.font = 'bold 18px "Courier New", Consolas, monospace';
				ctx.strokeText(publicIP || 'No Public IP', 72, 80);
				ctx.fillText(publicIP || 'No Public IP', 72, 80);
			}
		}

		// Convert to base64 data URI
		const buffer = canvas.toBuffer('image/png');
		const base64 = buffer.toString('base64');
		return `data:image/png;base64,${base64}`;
	}

	private getLocalIPAddress(settings: ToggleSettings): string | null {
		const nets = networkInterfaces();

		// If specific interface requested, use it
		if (settings.networkInterface) {
			const netInterface = nets[settings.networkInterface];
			if (netInterface) {
				for (const net of netInterface) {
					const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
					if (net.family === familyV4Value && !net.internal) {
						return net.address;
					}
				}
			}
			// Fall through to auto-detect if specified interface not found
		}

		// Auto-detect: return first non-internal IPv4
		for (const name of Object.keys(nets)) {
			const netInterface = nets[name];
			if (!netInterface) continue;

			for (const net of netInterface) {
				const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
				if (net.family === familyV4Value && !net.internal) {
					return net.address;
				}
			}
		}

		return null;
	}

	private async getWifiSSID(): Promise<string | null> {
		const now = Date.now();

		// Return cached SSID if it's still valid
		if (this.wifiSSIDCache.ssid && (now - this.wifiSSIDCache.timestamp) < this.SSID_CACHE_DURATION) {
			return this.wifiSSIDCache.ssid;
		}

		try {
			let command: string;
			let parseOutput: (output: string) => string | null;

			if (process.platform === 'darwin') {
				// macOS - try system_profiler first (works on Sequoia 15+)
				command = 'system_profiler SPAirPortDataType';
				parseOutput = (output: string) => {
					// Look for "Current Network Information:" followed by SSID
					const match = output.match(/Current Network Information:[\s\S]*?\n\s+([^:]+):/);
					if (match && match[1] && match[1].trim()) {
						return match[1].trim();
					}
					return null;
				};
			} else if (process.platform === 'win32') {
				// Windows - use netsh
				command = 'netsh wlan show interfaces';
				parseOutput = (output: string) => {
					// Look for "SSID" field (not "Profile")
					const match = output.match(/^\s*SSID\s*:\s*(.+)$/m);
					if (match && match[1] && match[1].trim()) {
						return match[1].trim();
					}
					return null;
				};
			} else {
				// Unsupported platform
				return null;
			}

			// Execute command with 5 second timeout
			const { stdout } = await execAsync(command, { timeout: 5000 });
			const ssid = parseOutput(stdout);

			// Cache the result (even if null)
			this.wifiSSIDCache = { ssid, timestamp: now };
			return ssid;
		} catch (error) {
			// Command failed (no WiFi, Ethernet, or other error) - return null silently
			streamDeck.logger.debug('WiFi SSID detection failed:', error);
			return null;
		}
	}

	private publicIPCache: { ip: string | null; timestamp: number } = { ip: null, timestamp: 0 };
	private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

	private async getPublicIPAddress(): Promise<string | null> {
		const now = Date.now();

		// Return cached IP if it's still valid
		if (this.publicIPCache.ip && (now - this.publicIPCache.timestamp) < this.CACHE_DURATION) {
			return this.publicIPCache.ip;
		}

		try {
			const response = await fetch('https://api.ipify.org?format=json', {
				method: 'GET',
				headers: { 'User-Agent': 'StreamDeckIPDisplay/1.0' }
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const data = await response.json() as { ip?: string };
			const publicIP = data.ip || null;

			// Cache the result
			this.publicIPCache = { ip: publicIP, timestamp: now };
			return publicIP;
		} catch (error) {
			streamDeck.logger.warn('Failed to fetch public IP:', error);
			// Keep old cached IP if available, otherwise return null
			return this.publicIPCache.ip;
		}
	}

	private startRefreshTimer(settings: ToggleSettings): void {
		// Clear existing timer
		if (this.refreshTimer) {
			clearInterval(this.refreshTimer);
			this.refreshTimer = null;
		}

		// Get refresh interval (default to 10 minutes)
		const { refreshInterval = 600000 } = settings;

		// Only start timer if interval > 0 (0 means manual only)
		if (refreshInterval > 0) {
			this.refreshTimer = setInterval(async () => {
				await this.refreshAllVisibleActions();
			}, refreshInterval);
		}
	}

	private async refreshAllVisibleActions(): Promise<void> {
		// Refresh all visible action instances
		for (const actionEvent of this.visibleActions.values()) {
			try {
				const { mode = 'dual' } = actionEvent.payload.settings;
				const localIP = this.getLocalIPAddress(actionEvent.payload.settings);
				const publicIP = await this.getPublicIPAddress();
				const imageDataUri = await this.generateToggleImage(localIP, publicIP, mode, actionEvent.payload.settings);
				await actionEvent.action.setImage(imageDataUri);
			} catch (error) {
				streamDeck.logger.warn('Failed to refresh toggle IP display:', error);
			}
		}
	}

	private async copyToClipboard(ev: KeyDownEvent<ToggleSettings>, localIP: string | null, publicIP: string | null, mode: 'dual' | 'local' | 'public'): Promise<void> {
		try {
			// Format based on mode
			let textToCopy = '';
			if (mode === 'dual') {
				if (localIP && publicIP) {
					textToCopy = `${localIP},${publicIP}`;
				} else if (localIP) {
					textToCopy = localIP;
				} else if (publicIP) {
					textToCopy = publicIP;
				} else {
					textToCopy = 'No IP address available';
				}
			} else if (mode === 'local') {
				textToCopy = localIP || 'No IP address available';
			} else {
				textToCopy = publicIP || 'No IP address available';
			}

			await clipboard.write(textToCopy);

			// Show success feedback
			await ev.action.showOk();
		} catch (error) {
			streamDeck.logger.error('=== CLIPBOARD COPY FAILED (Toggle IP) ===');
			streamDeck.logger.error('Error object:', error);
			streamDeck.logger.error('Error name:', (error as Error).name);
			streamDeck.logger.error('Error message:', (error as Error).message);
			streamDeck.logger.error('Error stack:', (error as Error).stack);
			streamDeck.logger.error('Local IP:', localIP);
			streamDeck.logger.error('Public IP:', publicIP);
			streamDeck.logger.error('Mode:', mode);
			streamDeck.logger.error('===========================');

			// Show failure feedback
			await ev.action.showAlert();
		}
	}

}