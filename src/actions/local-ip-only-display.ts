import streamDeck, { action, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent, SendToPluginEvent } from "@elgato/streamdeck";
import { networkInterfaces } from "os";
import { createCanvas } from "canvas";
import clipboard from "clipboardy";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

@action({ UUID: "io.piercefamily.ip-display.local-ip" })
export class LocalIPOnlyDisplay extends SingletonAction<IPSettings> {
	private refreshTimer: NodeJS.Timeout | null = null;
	private visibleActions = new Map<string, WillAppearEvent<IPSettings>>();
	private pressTimers = new Map<string, { timestamp: number, timer: NodeJS.Timeout, localIP: string | null }>();
	private readonly LONG_PRESS_THRESHOLD = 800; // milliseconds
	private wifiSSIDCache: { ssid: string | null; timestamp: number } = { ssid: null, timestamp: 0 };
	private readonly SSID_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
	override async onWillAppear(ev: WillAppearEvent<IPSettings>): Promise<void> {
		// Store this action instance
		this.visibleActions.set(ev.action.id, ev);

		// Display initial content
		const localIP = this.getLocalIPAddress(ev.payload.settings);
		const imageDataUri = await this.generateLocalIPImage(localIP, ev.payload.settings);
		await ev.action.setImage(imageDataUri);

		// Start auto-refresh timer
		this.startRefreshTimer(ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<IPSettings>): Promise<void> {
		const pressTime = Date.now();
		const localIP = this.getLocalIPAddress(ev.payload.settings);

		// Start long-press timer
		const timer = setTimeout(async () => {
			// Long press detected - copy to clipboard
			await this.copyToClipboard(ev, localIP);
		}, this.LONG_PRESS_THRESHOLD);

		// Store timer and IP for this press
		this.pressTimers.set(ev.action.id, { timestamp: pressTime, timer, localIP });
	}

	override async onKeyUp(ev: KeyUpEvent<IPSettings>): Promise<void> {
		const pressData = this.pressTimers.get(ev.action.id);
		if (!pressData) return;

		clearTimeout(pressData.timer);
		const duration = Date.now() - pressData.timestamp;

		if (duration < this.LONG_PRESS_THRESHOLD) {
			// Short press - refresh display
			const localIP = this.getLocalIPAddress(ev.payload.settings);
			const imageDataUri = await this.generateLocalIPImage(localIP, ev.payload.settings);
			await ev.action.setImage(imageDataUri);
		}
		// Long press already handled in setTimeout

		this.pressTimers.delete(ev.action.id);
	}

	override onWillDisappear(ev: WillDisappearEvent<IPSettings>): void {
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

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<IPSettings>): Promise<void> {
		// Restart timer with new settings
		this.startRefreshTimer(ev.payload.settings);

		// Refresh display with new settings
		const localIP = this.getLocalIPAddress(ev.payload.settings);
		const imageDataUri = await this.generateLocalIPImage(localIP, ev.payload.settings);
		await ev.action.setImage(imageDataUri);
	}

	override onSendToPlugin(ev: SendToPluginEvent<any, IPSettings>): void {
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

			streamDeck.ui.sendToPropertyInspector({
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

	private async generateLocalIPImage(localIP: string | null, settings: IPSettings): Promise<string> {
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

		// Get WiFi SSID if enabled
		const showSSID = settings.showWifiSSID !== false; // Default true
		const ssid = showSSID ? await this.getWifiSSID() : null;

		if (settings.multilineIP) {
			// Multiline mode - larger font, split IP
			const localSplit = this.splitIP(localIP);

			// LOCAL IP Section (Centered)
			// Measure text width for dot positioning
			ctx.font = 'bold 16px Arial';
			const label = settings.customLabel || 'LOCAL IP';
			const labelMetrics = ctx.measureText(label);
			const dotX = 72 - (labelMetrics.width / 2) - 10;

			// Status indicator dot before label
			ctx.fillStyle = localIP ? '#00FF00' : '#FF6B6B'; // Green if connected, red if not
			ctx.beginPath();
			ctx.arc(dotX, 28, 4, 0, 2 * Math.PI);
			ctx.fill();

			ctx.fillStyle = settings.labelColor || '#C0C0C0';
			ctx.strokeText(label, 72, 28);
			ctx.fillText(label, 72, 28);

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
			// Single-line mode - original layout
			// LOCAL IP Section (Centered)
			// Measure text width for dot positioning
			ctx.font = 'bold 16px Arial';
			const label = settings.customLabel || 'LOCAL IP';
			const labelMetrics = ctx.measureText(label);
			const dotX = 72 - (labelMetrics.width / 2) - 10;

			// Status indicator dot before label
			ctx.fillStyle = localIP ? '#00FF00' : '#FF6B6B'; // Green if connected, red if not
			ctx.beginPath();
			ctx.arc(dotX, 40, 4, 0, 2 * Math.PI);
			ctx.fill();

			ctx.fillStyle = settings.labelColor || '#C0C0C0';
			ctx.strokeText(label, 72, 40);
			ctx.fillText(label, 72, 40);

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

		// Convert to base64 data URI
		const buffer = canvas.toBuffer('image/png');
		const base64 = buffer.toString('base64');
		return `data:image/png;base64,${base64}`;
	}

	private getLocalIPAddress(settings: IPSettings): string | null {
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

	private startRefreshTimer(settings: IPSettings): void {
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
				const localIP = this.getLocalIPAddress(actionEvent.payload.settings);
				const imageDataUri = await this.generateLocalIPImage(localIP, actionEvent.payload.settings);
				await actionEvent.action.setImage(imageDataUri);
			} catch (error) {
				streamDeck.logger.warn('Failed to refresh local IP display:', error);
			}
		}
	}

	private async copyToClipboard(ev: KeyDownEvent<IPSettings>, localIP: string | null): Promise<void> {
		try {
			const textToCopy = localIP || 'No IP address available';
			await clipboard.write(textToCopy);

			// Show success feedback
			await ev.action.showOk();
		} catch (error) {
			streamDeck.logger.error('=== CLIPBOARD COPY FAILED (Local IP Only) ===');
			streamDeck.logger.error('Error object:', error);
			streamDeck.logger.error('Error name:', (error as Error).name);
			streamDeck.logger.error('Error message:', (error as Error).message);
			streamDeck.logger.error('Error stack:', (error as Error).stack);
			streamDeck.logger.error('Local IP:', localIP);
			streamDeck.logger.error('===========================');

			// Show failure feedback
			await ev.action.showAlert();
		}
	}

}

type IPSettings = {
	refreshInterval?: number;
	customLabel?: string;
	multilineIP?: boolean;
	networkInterface?: string;
	labelColor?: string;
	ipColor?: string;
	showWifiSSID?: boolean;
	ssidColor?: string;
};