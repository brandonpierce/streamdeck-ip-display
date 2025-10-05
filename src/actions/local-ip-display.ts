import streamDeck, { action, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";
import { networkInterfaces } from "os";
import { createCanvas } from "canvas";
import clipboard from "clipboardy";

@action({ UUID: "io.piercefamily.ip-display.dual-ip" })
export class IPDisplay extends SingletonAction<IPSettings> {
	private refreshTimer: NodeJS.Timeout | null = null;
	private visibleActions = new Map<string, WillAppearEvent<IPSettings>>();
	private pressTimers = new Map<string, { timestamp: number, timer: NodeJS.Timeout, localIP: string | null, publicIP: string | null }>();
	private readonly LONG_PRESS_THRESHOLD = 800; // milliseconds
	override async onWillAppear(ev: WillAppearEvent<IPSettings>): Promise<void> {
		// Store this action instance
		this.visibleActions.set(ev.action.id, ev);

		// Display initial content
		const localIP = this.getLocalIPAddress();
		const publicIP = await this.getPublicIPAddress();
		const imageDataUri = this.generateIPImage(localIP, publicIP);
		await ev.action.setImage(imageDataUri);

		// Start auto-refresh timer
		this.startRefreshTimer(ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<IPSettings>): Promise<void> {
		const pressTime = Date.now();
		const localIP = this.getLocalIPAddress();
		const publicIP = await this.getPublicIPAddress();

		// Start long-press timer
		const timer = setTimeout(async () => {
			// Long press detected - copy to clipboard
			await this.copyToClipboard(ev, localIP, publicIP);
		}, this.LONG_PRESS_THRESHOLD);

		// Store timer and IPs for this press
		this.pressTimers.set(ev.action.id, { timestamp: pressTime, timer, localIP, publicIP });
	}

	override async onKeyUp(ev: KeyUpEvent<IPSettings>): Promise<void> {
		const pressData = this.pressTimers.get(ev.action.id);
		if (!pressData) return;

		clearTimeout(pressData.timer);
		const duration = Date.now() - pressData.timestamp;

		if (duration < this.LONG_PRESS_THRESHOLD) {
			// Short press - refresh display with cache bypass
			this.publicIPCache = { ip: null, timestamp: 0 }; // Clear cache for fresh fetch
			const localIP = this.getLocalIPAddress();
			const publicIP = await this.getPublicIPAddress();
			const imageDataUri = this.generateIPImage(localIP, publicIP);
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

	override onDidReceiveSettings(ev: DidReceiveSettingsEvent<IPSettings>): void {
		// Restart timer with new settings
		this.startRefreshTimer(ev.payload.settings);
	}

	private generateIPImage(localIP: string | null, publicIP: string | null): string {
		const canvas = createCanvas(144, 144);
		const ctx = canvas.getContext('2d');

		// Text shadow for readability on transparent background
		ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
		ctx.shadowBlur = 4;
		ctx.shadowOffsetX = 1;
		ctx.shadowOffsetY = 1;

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		// LOCAL IP Section (Top)
		ctx.fillStyle = '#A0A0A0';
		ctx.font = 'bold 12px Arial';
		ctx.fillText('LOCAL IP', 72, 25);

		ctx.fillStyle = '#FFFFFF';
		ctx.font = 'bold 16px Arial';
		ctx.fillText(localIP || 'No Local IP', 72, 45);

		// PUBLIC IP Section (Bottom)
		ctx.fillStyle = '#A0A0A0';
		ctx.font = 'bold 12px Arial';
		ctx.fillText('PUBLIC IP', 72, 85);

		ctx.fillStyle = '#FFFFFF';
		ctx.font = 'bold 16px Arial';
		ctx.fillText(publicIP || 'No Public IP', 72, 105);

		// Connection status indicator (small dot)
		if (localIP && publicIP) {
			ctx.fillStyle = '#00FF00'; // Green - both connected
		} else if (localIP || publicIP) {
			ctx.fillStyle = '#FFAA00'; // Orange - partial connection
		} else {
			ctx.fillStyle = '#FF6B6B'; // Red - no connection
		}
		ctx.beginPath();
		ctx.arc(72, 125, 3, 0, 2 * Math.PI);
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
				const localIP = this.getLocalIPAddress();
				const publicIP = await this.getPublicIPAddress();
				const imageDataUri = this.generateIPImage(localIP, publicIP);
				await actionEvent.action.setImage(imageDataUri);
			} catch (error) {
				streamDeck.logger.warn('Failed to refresh IP display:', error);
			}
		}
	}

	private async copyToClipboard(ev: KeyDownEvent<IPSettings>, localIP: string | null, publicIP: string | null): Promise<void> {
		try {
			// Format: both IPs with labels
			let textToCopy = '';
			if (localIP && publicIP) {
				textToCopy = `Local: ${localIP}\nPublic: ${publicIP}`;
			} else if (localIP) {
				textToCopy = localIP;
			} else if (publicIP) {
				textToCopy = publicIP;
			} else {
				textToCopy = 'No IP address available';
			}

			await clipboard.write(textToCopy);

			// Show success feedback
			await ev.action.showOk();
		} catch (error) {
			streamDeck.logger.error('=== CLIPBOARD COPY FAILED ===');
			streamDeck.logger.error('Error object:', error);
			streamDeck.logger.error('Error name:', (error as Error).name);
			streamDeck.logger.error('Error message:', (error as Error).message);
			streamDeck.logger.error('Error stack:', (error as Error).stack);
			streamDeck.logger.error('Local IP:', localIP);
			streamDeck.logger.error('Public IP:', publicIP);
			streamDeck.logger.error('===========================');

			// Show failure feedback
			await ev.action.showAlert();
		}
	}

}

type IPSettings = {
	refreshInterval?: number;
};