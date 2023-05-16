require("dotenv").config();
require("./keep_alive.js");

const { WebhookClient } = require("discord.js");
const utils = require("./utils");
const steamclient = require("./steamclient.js").buildBot;
const Client = require("@replit/database");

const webhookClient = new WebhookClient({ url: process.env.webhook });
const client = new Client();
const max = parseInt(process.env.max, 10);
const games = JSON.parse(process.env.games);
const bots = [];

(async () => {
	for (let i = 0; i < max; i++) {
		let acc = await client.get(`acc-${i}`);
		if (utils.getExpiration(acc.refreshToken).expired) {
			acc = await utils.startWithQR(webhookClient);
			client.set(`acc-${i}`, ...acc);
			i--;
		} else {
			bots.push(await steamclient(acc, games[i], client, webhookClient));
		}
	}
})();
