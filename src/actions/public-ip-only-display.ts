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
		const imageDataUri = this.generatePublicIPImage(publicIP);
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
			const imageDataUri = this.generatePublicIPImage(publicIP);
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

	private generatePublicIPImage(publicIP: string | null): string {
		const canvas = createCanvas(144, 144);
		const ctx = canvas.getContext('2d');

		// Text shadow for readability on transparent background
		ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
		ctx.shadowBlur = 4;
		ctx.shadowOffsetX = 1;
		ctx.shadowOffsetY = 1;

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		// PUBLIC IP Section (Centered)
		ctx.fillStyle = '#A0A0A0';
		ctx.font = 'bold 14px Arial';
		ctx.fillText('PUBLIC IP', 72, 50);

		ctx.fillStyle = '#FFFFFF';
		ctx.font = 'bold 18px Arial';
		ctx.fillText(publicIP || 'No Public IP', 72, 80);

		// Connection status indicator (small dot)
		ctx.fillStyle = publicIP ? '#00FF00' : '#FF6B6B'; // Green if connected, red if not
		ctx.beginPath();
		ctx.arc(72, 110, 4, 0, 2 * Math.PI);
		ctx.fill();

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
				const imageDataUri = this.generatePublicIPImage(publicIP);
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
			const feedbackImage = this.generateCopyFeedbackImage(true);
			await ev.action.setImage(feedbackImage);

			// Restore normal display after 1 second
			setTimeout(async () => {
				const imageDataUri = this.generatePublicIPImage(publicIP);
				await ev.action.setImage(imageDataUri);
			}, 1000);
		} catch (error) {
			streamDeck.logger.error('=== CLIPBOARD COPY FAILED (Public IP Only) ===');
			streamDeck.logger.error('Error object:', error);
			streamDeck.logger.error('Error name:', (error as Error).name);
			streamDeck.logger.error('Error message:', (error as Error).message);
			streamDeck.logger.error('Error stack:', (error as Error).stack);
			streamDeck.logger.error('Public IP:', publicIP);
			streamDeck.logger.error('===========================');

			// Show failure feedback
			const feedbackImage = this.generateCopyFeedbackImage(false);
			await ev.action.setImage(feedbackImage);

			// Restore normal display after 1 second
			setTimeout(async () => {
				const imageDataUri = this.generatePublicIPImage(publicIP);
				await ev.action.setImage(imageDataUri);
			}, 1000);
		}
	}

	private generateCopyFeedbackImage(success: boolean): string {
		const canvas = createCanvas(144, 144);
		const ctx = canvas.getContext('2d');

		ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
		ctx.shadowBlur = 4;
		ctx.shadowOffsetX = 1;
		ctx.shadowOffsetY = 1;

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		if (success) {
			ctx.fillStyle = '#00FF00';
			ctx.font = 'bold 48px Arial';
			ctx.fillText('✓', 72, 60);

			ctx.fillStyle = '#FFFFFF';
			ctx.font = 'bold 16px Arial';
			ctx.fillText('COPIED', 72, 100);
		} else {
			ctx.fillStyle = '#FF6B6B';
			ctx.font = 'bold 48px Arial';
			ctx.fillText('✗', 72, 60);

			ctx.fillStyle = '#FFFFFF';
			ctx.font = 'bold 16px Arial';
			ctx.fillText('FAILED', 72, 100);
		}

		const buffer = canvas.toBuffer('image/png');
		const base64 = buffer.toString('base64');
		return `data:image/png;base64,${base64}`;
	}
}

type IPSettings = {
	refreshInterval?: number;
};