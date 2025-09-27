import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { networkInterfaces } from "os";
import { createCanvas } from "canvas";

type ToggleSettings = {
	mode: 'dual' | 'local' | 'public';
};

@action({ UUID: "io.piercefamily.ip-display.toggle" })
export class ToggleIPDisplay extends SingletonAction<ToggleSettings> {
	override async onWillAppear(ev: WillAppearEvent<ToggleSettings>): Promise<void> {
		// Get current mode from settings, default to 'dual'
		const { mode = 'dual' } = ev.payload.settings;

		const localIP = this.getLocalIPAddress();
		const publicIP = await this.getPublicIPAddress();
		const imageDataUri = this.generateToggleImage(localIP, publicIP, mode);
		await ev.action.setImage(imageDataUri);
	}

	override async onKeyDown(ev: KeyDownEvent<ToggleSettings>): Promise<void> {
		// Get current mode and cycle to next
		const { mode = 'dual' } = ev.payload.settings;
		const nextMode = this.getNextMode(mode);

		// Save the new mode
		await ev.action.setSettings({ mode: nextMode });

		// Update display with new mode
		const localIP = this.getLocalIPAddress();
		const publicIP = await this.getPublicIPAddress();
		const imageDataUri = this.generateToggleImage(localIP, publicIP, nextMode);
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

	private generateToggleImage(localIP: string | null, publicIP: string | null, mode: 'dual' | 'local' | 'public'): string {
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
			// Dual IP display (similar to original)
			ctx.fillStyle = '#A0A0A0';
			ctx.font = 'bold 12px Arial';
			ctx.fillText('LOCAL IP', 72, 35);

			ctx.fillStyle = '#FFFFFF';
			ctx.font = 'bold 14px Arial';
			ctx.fillText(localIP || 'No Local IP', 72, 52);

			ctx.fillStyle = '#A0A0A0';
			ctx.font = 'bold 12px Arial';
			ctx.fillText('PUBLIC IP', 72, 80);

			ctx.fillStyle = '#FFFFFF';
			ctx.font = 'bold 14px Arial';
			ctx.fillText(publicIP || 'No Public IP', 72, 97);

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
			ctx.fillText('LOCAL IP', 72, 55);

			ctx.fillStyle = '#FFFFFF';
			ctx.font = 'bold 18px Arial';
			ctx.fillText(localIP || 'No Local IP', 72, 80);

			// Connection status indicator
			ctx.fillStyle = localIP ? '#00FF00' : '#FF6B6B'; // Green if connected, red if not
		} else {
			// Public IP only display
			ctx.fillStyle = '#A0A0A0';
			ctx.font = 'bold 14px Arial';
			ctx.fillText('PUBLIC IP', 72, 55);

			ctx.fillStyle = '#FFFFFF';
			ctx.font = 'bold 18px Arial';
			ctx.fillText(publicIP || 'No Public IP', 72, 80);

			// Connection status indicator
			ctx.fillStyle = publicIP ? '#00FF00' : '#FF6B6B'; // Green if connected, red if not
		}

		// Draw status indicator dot
		ctx.beginPath();
		const dotY = mode === 'dual' ? 115 : 105;
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
			console.warn('Failed to fetch public IP:', error);
			// Keep old cached IP if available, otherwise return null
			return this.publicIPCache.ip;
		}
	}
}