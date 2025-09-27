import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { networkInterfaces } from "os";

@action({ UUID: "io.piercefamily.ip-display.local-ip" })
export class LocalIPDisplay extends SingletonAction<LocalIPSettings> {
	override async onWillAppear(ev: WillAppearEvent<LocalIPSettings>): Promise<void> {
		const localIP = this.getLocalIPAddress();
		await ev.action.setTitle(localIP || "No IP");
	}

	override async onKeyDown(ev: KeyDownEvent<LocalIPSettings>): Promise<void> {
		const localIP = this.getLocalIPAddress();
		await ev.action.setTitle(localIP || "No IP");
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