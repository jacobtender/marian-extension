import { config, env } from './base-config.mjs';

let startUrl = ['about:debugging'];
if (env.START_URLS) {
	startUrl = env.START_URLS.split(",");
}

export default {
	...config,
	sourceDir: './distro/firefox',
	run: {
		firefox: env.FIREFOX_VERSION || 'firefox',
		target: ['firefox-desktop'],
		startUrl,
	},
};
