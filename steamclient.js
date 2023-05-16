const SteamUser = require("steam-user");

async function buildBot(config, game, client, webhookClient) {
	const bot = new SteamUser({
		dataDirectory: "./sentry",
		singleSentryfile: false,
		autoRelogin: true,
		rememberPassword: true,
	});

	bot.on("loggedOn", async function (details) {
		webhookClient.send({
			content: `[${config.accountName}] Вошёл в Steam ${bot.steamID.getSteam3RenderedID()}`,
			username: config.accountName,
		});
		bot.gamesPlayed(game);
		bot.setPersona(SteamUser.EPersonaState.offline);
	});

	bot.on("disconnected", function (e, msg) {
		console.log("[" + config.accountName + "] " + msg);
		webhookClient.send({
			content: `[${config.accountName}] ${msg}`,
			username: config.accountName,
		});
	});

	bot.on("error", function (e) {
		console.log("[" + config.accountName + "] " + e);
		webhookClient.send({
			content: `[${config.accountName}] ${e}`,
			username: config.accountName,
		});
		setTimeout(async () =>
			await bot.logOn({
				refreshToken: config.refreshToken,
				steamID: config.steamID,
			}),
			15 * 60 * 1000
		);
	});

	bot.on("steamGuard", async function (domain, callback, lastCodeWrong) {
		webhookClient.send({
			content: `[${config.accountName}] Нужен код авторизации`,
			username: config.accountName,
		});
	});

	bot.on("friendMessage", function (steamID, message) {
		webhookClient.send({
			content: `[${config.accountName}] Сообщение от ${steamID}: ${message}`,
			username: config.accountName,
		});
	});

	bot.storage.on("save", function (filename, contents, callback) {
		config.client.set(filename, {
			value: typeof contents == "object" ? contents.toString("base64") : contents,
		});
	});

	bot.storage.on("read", function (filename, callback) {
		config.client.get(filename).then(({ value }) => {
				callback(
					null,
					typeof value == "string" ? Buffer.from(value, "base64") : value
				);
			})
			.catch((err) => callback(err));
	});

	await bot.logOn({
		refreshToken: config.refreshToken,
		steamID: config.steamID,
	});

	return bot;
}

module.exports.buildBot = buildBot;
