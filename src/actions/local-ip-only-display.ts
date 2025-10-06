import streamDeck, { action, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";
import { networkInterfaces } from "os";
import { createCanvas } from "canvas";
import clipboard from "clipboardy";

@action({ UUID: "io.piercefamily.ip-display.local-ip" })
export class LocalIPOnlyDisplay extends SingletonAction<IPSettings> {
	private refreshTimer: NodeJS.Timeout | null = null;
	private visibleActions = new Map<string, WillAppearEvent<IPSettings>>();
	private pressTimers = new Map<string, { timestamp: number, timer: NodeJS.Timeout, localIP: string | null }>();
	private readonly LONG_PRESS_THRESHOLD = 800; // milliseconds
	override async onWillAppear(ev: WillAppearEvent<IPSettings>): Promise<void> {
		// Store this action instance
		this.visibleActions.set(ev.action.id, ev);

		// Display initial content
		const localIP = this.getLocalIPAddress();
		const imageDataUri = this.generateLocalIPImage(localIP, ev.payload.settings);
		await ev.action.setImage(imageDataUri);

		// Start auto-refresh timer
		this.startRefreshTimer(ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<IPSettings>): Promise<void> {
		const pressTime = Date.now();
		const localIP = this.getLocalIPAddress();

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
			const localIP = this.getLocalIPAddress();
			const imageDataUri = this.generateLocalIPImage(localIP, ev.payload.settings);
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
		const localIP = this.getLocalIPAddress();
		const imageDataUri = this.generateLocalIPImage(localIP, ev.payload.settings);
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

	private generateLocalIPImage(localIP: string | null, settings: IPSettings): string {
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
			const localSplit = this.splitIP(localIP);

			// LOCAL IP Section (Centered)
			ctx.fillStyle = '#C0C0C0';
			ctx.font = 'bold 16px Arial';
			const label = settings.customLabel || 'LOCAL IP';
			ctx.fillText(label, 72, 35);

			ctx.fillStyle = '#FFFFFF';
			ctx.font = 'bold 26px "Courier New", Consolas, monospace';
			if (localSplit) {
				ctx.fillText(localSplit.line1, 72, 60);
				ctx.fillText(localSplit.line2, 72, 90);
			} else {
				ctx.fillText('No Local IP', 72, 75);
			}
		} else {
			// Single-line mode - original layout
			// LOCAL IP Section (Centered)
			ctx.fillStyle = '#C0C0C0';
			ctx.font = 'bold 16px Arial';
			const label = settings.customLabel || 'LOCAL IP';
			ctx.fillText(label, 72, 48);

			ctx.fillStyle = '#FFFFFF';
			ctx.font = 'bold 18px "Courier New", Consolas, monospace';
			ctx.fillText(localIP || 'No Local IP', 72, 80);
		}

		// Connection status indicator (small dot)
		ctx.fillStyle = localIP ? '#00FF00' : '#FF6B6B'; // Green if connected, red if not
		ctx.beginPath();
		ctx.arc(72, 115, 4, 0, 2 * Math.PI);
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
				const imageDataUri = this.generateLocalIPImage(localIP, actionEvent.payload.settings);
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
};