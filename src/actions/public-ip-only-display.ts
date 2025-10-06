import streamDeck, { action, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";
import { createCanvas } from "canvas";
import clipboard from "clipboardy";

@action({ UUID: "io.piercefamily.ip-display.public-ip" })
export class PublicIPOnlyDisplay extends SingletonAction<IPSettings> {
	private refreshTimer: NodeJS.Timeout | null = null;
	private visibleActions = new Map<string, WillAppearEvent<IPSettings>>();
	private pressTimers = new Map<string, { timestamp: number, timer: NodeJS.Timeout, publicIP: string | null }>();
	private readonly LONG_PRESS_THRESHOLD = 800; // milliseconds
	override async onWillAppear(ev: WillAppearEvent<IPSettings>): Promise<void> {
		// Store this action instance
		this.visibleActions.set(ev.action.id, ev);

		// Display initial content
		const publicIP = await this.getPublicIPAddress();
		const imageDataUri = this.generatePublicIPImage(publicIP, ev.payload.settings);
		await ev.action.setImage(imageDataUri);

		// Start auto-refresh timer
		this.startRefreshTimer(ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<IPSettings>): Promise<void> {
		const pressTime = Date.now();
		const publicIP = await this.getPublicIPAddress();

		// Start long-press timer
		const timer = setTimeout(async () => {
			// Long press detected - copy to clipboard
			await this.copyToClipboard(ev, publicIP);
		}, this.LONG_PRESS_THRESHOLD);

		// Store timer and IP for this press
		this.pressTimers.set(ev.action.id, { timestamp: pressTime, timer, publicIP });
	}

	override async onKeyUp(ev: KeyUpEvent<IPSettings>): Promise<void> {
		const pressData = this.pressTimers.get(ev.action.id);
		if (!pressData) return;

		clearTimeout(pressData.timer);
		const duration = Date.now() - pressData.timestamp;

		if (duration < this.LONG_PRESS_THRESHOLD) {
			// Short press - refresh display with cache bypass
			this.publicIPCache = { ip: null, timestamp: 0 }; // Clear cache for fresh fetch
			const publicIP = await this.getPublicIPAddress();
			const imageDataUri = this.generatePublicIPImage(publicIP, ev.payload.settings);
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
		const publicIP = await this.getPublicIPAddress();
		const imageDataUri = this.generatePublicIPImage(publicIP, ev.payload.settings);
		await ev.action.setImage(imageDataUri);
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

	private generatePublicIPImage(publicIP: string | null, settings: IPSettings): string {
		const canvas = createCanvas(144, 144);
		const ctx = canvas.getContext('2d');

		// Text shadow for readability on transparent background
		ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
		ctx.shadowBlur = 2;
		ctx.shadowOffsetX = 1;
		ctx.shadowOffsetY = 1;

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		if (settings.multilineIP) {
			// Multiline mode - larger font, split IP
			const publicSplit = this.splitIP(publicIP);

			// PUBLIC IP Section (Centered)
			// Measure text width for dot positioning
			ctx.font = 'bold 16px Arial';
			const label = settings.customLabel || 'PUBLIC IP';
			const labelMetrics = ctx.measureText(label);
			const dotX = 72 - (labelMetrics.width / 2) - 10;

			// Status indicator dot before label
			ctx.fillStyle = publicIP ? '#00FF00' : '#FF6B6B'; // Green if connected, red if not
			ctx.beginPath();
			ctx.arc(dotX, 35, 4, 0, 2 * Math.PI);
			ctx.fill();

			ctx.fillStyle = '#C0C0C0';
			ctx.fillText(label, 72, 35);

			ctx.fillStyle = '#FFFFFF';
			ctx.font = 'bold 28px "Courier New", Consolas, monospace';
			if (publicSplit) {
				ctx.fillText(publicSplit.line1, 72, 65);
				ctx.fillText(publicSplit.line2, 72, 100);
			} else {
				ctx.fillText('No Public IP', 72, 82);
			}
		} else {
			// Single-line mode - original layout
			// PUBLIC IP Section (Centered)
			// Measure text width for dot positioning
			ctx.font = 'bold 16px Arial';
			const label = settings.customLabel || 'PUBLIC IP';
			const labelMetrics = ctx.measureText(label);
			const dotX = 72 - (labelMetrics.width / 2) - 10;

			// Status indicator dot before label
			ctx.fillStyle = publicIP ? '#00FF00' : '#FF6B6B'; // Green if connected, red if not
			ctx.beginPath();
			ctx.arc(dotX, 48, 4, 0, 2 * Math.PI);
			ctx.fill();

			ctx.fillStyle = '#C0C0C0';
			ctx.fillText(label, 72, 48);

			ctx.fillStyle = '#FFFFFF';
			ctx.font = 'bold 18px "Courier New", Consolas, monospace';
			ctx.fillText(publicIP || 'No Public IP', 72, 80);
		}

		// Convert to base64 data URI
		const buffer = canvas.toBuffer('image/png');
		const base64 = buffer.toString('base64');
		return `data:image/png;base64,${base64}`;
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
				const publicIP = await this.getPublicIPAddress();
				const imageDataUri = this.generatePublicIPImage(publicIP, actionEvent.payload.settings);
				await actionEvent.action.setImage(imageDataUri);
			} catch (error) {
				streamDeck.logger.warn('Failed to refresh public IP display:', error);
			}
		}
	}

	private async copyToClipboard(ev: KeyDownEvent<IPSettings>, publicIP: string | null): Promise<void> {
		try {
			const textToCopy = publicIP || 'No IP address available';
			await clipboard.write(textToCopy);

			// Show success feedback
			await ev.action.showOk();
		} catch (error) {
			streamDeck.logger.error('=== CLIPBOARD COPY FAILED (Public IP Only) ===');
			streamDeck.logger.error('Error object:', error);
			streamDeck.logger.error('Error name:', (error as Error).name);
			streamDeck.logger.error('Error message:', (error as Error).message);
			streamDeck.logger.error('Error stack:', (error as Error).stack);
			streamDeck.logger.error('Public IP:', publicIP);
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
};