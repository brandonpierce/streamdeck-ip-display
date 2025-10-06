import streamDeck, { action, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";
import { networkInterfaces } from "os";
import { createCanvas } from "canvas";
import clipboard from "clipboardy";

type ToggleSettings = {
	mode: 'dual' | 'local' | 'public';
	refreshInterval?: number;
	customLocalLabel?: string;
	customPublicLabel?: string;
};

@action({ UUID: "io.piercefamily.ip-display.toggle" })
export class ToggleIPDisplay extends SingletonAction<ToggleSettings> {
	private refreshTimer: NodeJS.Timeout | null = null;
	private visibleActions = new Map<string, WillAppearEvent<ToggleSettings>>();
	private pressTimers = new Map<string, { timestamp: number, timer: NodeJS.Timeout, localIP: string | null, publicIP: string | null, mode: 'dual' | 'local' | 'public' }>();
	private readonly LONG_PRESS_THRESHOLD = 800; // milliseconds
	override async onWillAppear(ev: WillAppearEvent<ToggleSettings>): Promise<void> {
		// Store this action instance
		this.visibleActions.set(ev.action.id, ev);

		// Get current mode from settings, default to 'dual'
		const { mode = 'dual' } = ev.payload.settings;

		// Display initial content
		const localIP = this.getLocalIPAddress();
		const publicIP = await this.getPublicIPAddress();
		const imageDataUri = this.generateToggleImage(localIP, publicIP, mode, ev.payload.settings);
		await ev.action.setImage(imageDataUri);

		// Start auto-refresh timer
		this.startRefreshTimer(ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<ToggleSettings>): Promise<void> {
		const pressTime = Date.now();
		const { mode = 'dual' } = ev.payload.settings;
		const localIP = this.getLocalIPAddress();
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

			// Manual refresh - force cache bypass for public IP
			const localIP = this.getLocalIPAddress();
			this.publicIPCache = { ip: null, timestamp: 0 }; // Clear cache for fresh fetch
			const publicIP = await this.getPublicIPAddress();
			const imageDataUri = this.generateToggleImage(localIP, publicIP, nextMode, ev.payload.settings);
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
		const localIP = this.getLocalIPAddress();
		const publicIP = await this.getPublicIPAddress();
		const imageDataUri = this.generateToggleImage(localIP, publicIP, mode, ev.payload.settings);
		await ev.action.setImage(imageDataUri);
	}

	private getNextMode(currentMode: string): 'dual' | 'local' | 'public' {
		switch (currentMode) {
			case 'dual': return 'local';
			case 'local': return 'public';
			case 'public': return 'dual';
			default: return 'dual';
		}
	}

	private generateToggleImage(localIP: string | null, publicIP: string | null, mode: 'dual' | 'local' | 'public', settings: ToggleSettings): string {
		const canvas = createCanvas(144, 144);
		const ctx = canvas.getContext('2d');

		// Text shadow for readability on transparent background
		ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
		ctx.shadowBlur = 4;
		ctx.shadowOffsetX = 1;
		ctx.shadowOffsetY = 1;

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		if (mode === 'dual') {
			// Dual IP display (matches Dual IP Display layout)
			ctx.fillStyle = '#A0A0A0';
			ctx.font = 'bold 12px Arial';
			const localLabel = settings.customLocalLabel || 'LOCAL IP';
			ctx.fillText(localLabel, 72, 25);

			ctx.fillStyle = '#FFFFFF';
			ctx.font = 'bold 16px Arial';
			ctx.fillText(localIP || 'No Local IP', 72, 45);

			ctx.fillStyle = '#A0A0A0';
			ctx.font = 'bold 12px Arial';
			const publicLabel = settings.customPublicLabel || 'PUBLIC IP';
			ctx.fillText(publicLabel, 72, 85);

			ctx.fillStyle = '#FFFFFF';
			ctx.font = 'bold 16px Arial';
			ctx.fillText(publicIP || 'No Public IP', 72, 105);

			// Connection status indicator
			if (localIP && publicIP) {
				ctx.fillStyle = '#00FF00'; // Green - both connected
			} else if (localIP || publicIP) {
				ctx.fillStyle = '#FFAA00'; // Orange - partial connection
			} else {
				ctx.fillStyle = '#FF6B6B'; // Red - no connection
			}
		} else if (mode === 'local') {
			// Local IP only display
			ctx.fillStyle = '#A0A0A0';
			ctx.font = 'bold 14px Arial';
			const localLabel = settings.customLocalLabel || 'LOCAL IP';
			ctx.fillText(localLabel, 72, 55);

			ctx.fillStyle = '#FFFFFF';
			ctx.font = 'bold 18px Arial';
			ctx.fillText(localIP || 'No Local IP', 72, 80);

			// Connection status indicator
			ctx.fillStyle = localIP ? '#00FF00' : '#FF6B6B'; // Green if connected, red if not
		} else {
			// Public IP only display
			ctx.fillStyle = '#A0A0A0';
			ctx.font = 'bold 14px Arial';
			const publicLabel = settings.customPublicLabel || 'PUBLIC IP';
			ctx.fillText(publicLabel, 72, 55);

			ctx.fillStyle = '#FFFFFF';
			ctx.font = 'bold 18px Arial';
			ctx.fillText(publicIP || 'No Public IP', 72, 80);

			// Connection status indicator
			ctx.fillStyle = publicIP ? '#00FF00' : '#FF6B6B'; // Green if connected, red if not
		}

		// Draw status indicator dot
		ctx.beginPath();
		const dotY = mode === 'dual' ? 125 : 105;
		ctx.arc(72, dotY, mode === 'dual' ? 3 : 4, 0, 2 * Math.PI);
		ctx.fill();

		// Convert to base64 data URI
		const buffer = canvas.toBuffer('image/png');
		const base64 = buffer.toString('base64');
		return `data:image/png;base64,${base64}`;
	}

	private getLocalIPAddress(): string | null {
		const nets = networkInterfaces();

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
				const localIP = this.getLocalIPAddress();
				const publicIP = await this.getPublicIPAddress();
				const imageDataUri = this.generateToggleImage(localIP, publicIP, mode, actionEvent.payload.settings);
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
					textToCopy = `Local: ${localIP}\nPublic: ${publicIP}`;
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