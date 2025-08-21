import { config, env } from './base-config.mjs';

let startUrl = ['chrome://extensions'];
if (env.START_URLS) {
	startUrl = env.START_URLS.split(",");
}

let chromeConfig = {};
// doing it this way so that it'll use the default chromium binary instead of requiring it to be overridden
if (env.CHROMIUM_BINARY) {
	chromeConfig = {
		chromiumBinary: env.CHROMIUM_BINARY
	}
}

export default {
	...config,
	sourceDir: './distro/chrome',
	run: {
		target: ['chromium'],
		...chromeConfig,
		startUrl,
	},
};
