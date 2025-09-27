import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { networkInterfaces } from "os";
import { createCanvas } from "canvas";

@action({ UUID: "io.piercefamily.ip-display.dual-ip" })
export class IPDisplay extends SingletonAction<IPSettings> {
	override async onWillAppear(ev: WillAppearEvent<IPSettings>): Promise<void> {
		const localIP = this.getLocalIPAddress();
		const publicIP = await this.getPublicIPAddress();
		const imageDataUri = this.generateIPImage(localIP, publicIP);
		await ev.action.setImage(imageDataUri);
	}

	override async onKeyDown(ev: KeyDownEvent<IPSettings>): Promise<void> {
		const localIP = this.getLocalIPAddress();
		const publicIP = await this.getPublicIPAddress();
		const imageDataUri = this.generateIPImage(localIP, publicIP);
		await ev.action.setImage(imageDataUri);
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
			console.warn('Failed to fetch public IP:', error);
			// Keep old cached IP if available, otherwise return null
			return this.publicIPCache.ip;
		}
	}
}

type IPSettings = {
	refreshInterval?: number;
};