import { config, env } from './base-config.mjs';

let startUrl = ['chrome://extensions'];
if (env.START_URLS) {
	startUrl = env.START_URLS.split(",");
}

export default {
	...config,
	sourceDir: './distro/chrome',
	run: {
		target: ['chromium'],
		chromiumBinary: env.CHROMIUM_BINARY || "chromium-browser",
		startUrl,
	},
};
