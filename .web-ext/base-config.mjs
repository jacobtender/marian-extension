import dotenv from 'dotenv';
import fs from "fs";
const { error, parsed: env } = dotenv.config();

if (error) {
	if (error?.code === 'ENOENT') {
		// copy the example .env config over for next time
		fs.cpSync(".env.example", ".env")
	} else {
		console.error(error);
	}
}

export const config = {
	verbose: env.WEBEXT_VERBOSE === 'true',
};

export { env };
