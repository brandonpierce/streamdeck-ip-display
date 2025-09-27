import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { networkInterfaces } from "os";
import { createCanvas } from "canvas";

@action({ UUID: "io.piercefamily.ip-display.local-ip" })
export class LocalIPDisplay extends SingletonAction<LocalIPSettings> {
	override async onWillAppear(ev: WillAppearEvent<LocalIPSettings>): Promise<void> {
		const localIP = this.getLocalIPAddress();
		const imageDataUri = this.generateIPImage(localIP);
		await ev.action.setImage(imageDataUri);
	}

	override async onKeyDown(ev: KeyDownEvent<LocalIPSettings>): Promise<void> {
		const localIP = this.getLocalIPAddress();
		const imageDataUri = this.generateIPImage(localIP);
		await ev.action.setImage(imageDataUri);
	}

	private generateIPImage(ipAddress: string | null): string {
		const canvas = createCanvas(144, 144);
		const ctx = canvas.getContext('2d');

		// Text shadow for readability on transparent background
		ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
		ctx.shadowBlur = 4;
		ctx.shadowOffsetX = 1;
		ctx.shadowOffsetY = 1;

		if (ipAddress) {
			// Label text "LOCAL IP"
			ctx.fillStyle = '#A0A0A0';
			ctx.font = 'bold 14px Arial';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText('LOCAL IP', 72, 35);

			// IP address text
			ctx.fillStyle = '#FFFFFF';
			ctx.font = 'bold 20px Arial';
			ctx.fillText(ipAddress, 72, 85);
		} else {
			// Error state - no IP
			ctx.fillStyle = '#FF6B6B';
			ctx.font = 'bold 16px Arial';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText('NO IP', 72, 60);
			ctx.fillText('DETECTED', 72, 84);
		}

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
}

type LocalIPSettings = {
	refreshInterval?: number;
};