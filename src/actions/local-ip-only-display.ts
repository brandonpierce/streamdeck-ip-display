import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";
import { networkInterfaces } from "os";
import { createCanvas } from "canvas";

@action({ UUID: "io.piercefamily.ip-display.local-ip" })
export class LocalIPOnlyDisplay extends SingletonAction<IPSettings> {
	private refreshTimer: NodeJS.Timeout | null = null;
	private visibleActions = new Map<string, WillAppearEvent<IPSettings>>();
	override async onWillAppear(ev: WillAppearEvent<IPSettings>): Promise<void> {
		// Store this action instance
		this.visibleActions.set(ev.action.id, ev);

		// Display initial content
		const localIP = this.getLocalIPAddress();
		const imageDataUri = this.generateLocalIPImage(localIP);
		await ev.action.setImage(imageDataUri);

		// Start auto-refresh timer
		this.startRefreshTimer(ev.payload.settings);
	}

	override async onKeyDown(ev: KeyDownEvent<IPSettings>): Promise<void> {
		// Manual refresh - get fresh local IP
		const localIP = this.getLocalIPAddress();
		const imageDataUri = this.generateLocalIPImage(localIP);
		await ev.action.setImage(imageDataUri);
	}

	override onWillDisappear(ev: WillDisappearEvent<IPSettings>): void {
		// Remove this action instance
		this.visibleActions.delete(ev.action.id);

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

	private generateLocalIPImage(localIP: string | null): string {
		const canvas = createCanvas(144, 144);
		const ctx = canvas.getContext('2d');

		// Text shadow for readability on transparent background
		ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
		ctx.shadowBlur = 4;
		ctx.shadowOffsetX = 1;
		ctx.shadowOffsetY = 1;

		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		// LOCAL IP Section (Centered)
		ctx.fillStyle = '#A0A0A0';
		ctx.font = 'bold 14px Arial';
		ctx.fillText('LOCAL IP', 72, 50);

		ctx.fillStyle = '#FFFFFF';
		ctx.font = 'bold 18px Arial';
		ctx.fillText(localIP || 'No Local IP', 72, 80);

		// Connection status indicator (small dot)
		ctx.fillStyle = localIP ? '#00FF00' : '#FF6B6B'; // Green if connected, red if not
		ctx.beginPath();
		ctx.arc(72, 110, 4, 0, 2 * Math.PI);
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
				const imageDataUri = this.generateLocalIPImage(localIP);
				await actionEvent.action.setImage(imageDataUri);
			} catch (error) {
				console.warn('Failed to refresh local IP display:', error);
			}
		}
	}
}

type IPSettings = {
	refreshInterval?: number;
};