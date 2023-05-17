const { LoginSession, EAuthTokenPlatformType } = require("steam-session");
const { AttachmentBuilder, EmbedBuilder } = require("discord.js");
const QRCode = require("qrcode");
const util = require("util");

async function startWithQR(webhook, msg, callback) {
	const embed = new EmbedBuilder()
		.setTitle("Авторизация")
		.setDescription(
			"Создан QR-код.\nПожалуйста, отсканируйте его с помощью приложения Steam Mobile Authenticator."
		)
		.setColor(0x00ffff)
		.setTimestamp()
		.setImage("attachment://qrcode.png");

	const session = new LoginSession(EAuthTokenPlatformType.SteamClient);
	const qrCodeData = await session.startWithQR();
	callback = typeof msg == "function" ? msg : callback
	msg = typeof msg == "string" ? msg : null;
	if (msg) {
		webhook.editMessage(msg, {
			embeds: [embed],
			files: [
				new AttachmentBuilder(
					await QRCode.toBuffer(qrCodeData.qrChallengeUrl),
					{ name: "qrcode.png" }
				),
			],
		});
	} else {
		msg = await webhook.send({
			embeds: [embed],
			files: [
				new AttachmentBuilder(
					await QRCode.toBuffer(qrCodeData.qrChallengeUrl),
					{ name: "qrcode.png" }
				),
			],
		});
	}

	session.on("authenticated", () => {
		let embed1 = new EmbedBuilder()
		.setTitle("Авторизация")
		.setDescription(
			session?.accountName + ", аутентификация прошла успешно!"
		)
		.setColor(0x00ffff)
		.setTimestamp()

		webhook.editMessage(msg?.id || msg, {
			embeds: [embed1],
			files: [],
		});
		console.log("Аутентификация прошла успешно!");
		callback(null, {
			accountName: session?.accountName,
			refreshToken: session?.refreshToken,
			steamID: session?.steamID?.toString?.(),
		});
	});

	session.on("remoteInteraction", () => {
		let embed1 = new EmbedBuilder()
		.setTitle("Авторизация")
		.setDescription(
			"Код отсканирован!\nПожалуйста, подтвердите запрос на вход в систему в приложении Steam Mobile Authenticator."
		)
		.setColor(0x00ffff)
		.setTimestamp()

		webhook.editMessage(msg?.id || msg, {
			embeds: [embed],
			files: [],
		});
	});

	session.on("timeout", () => startWithQR(webhook, msg?.id || msg, callback));

	session.on("error", (error) => {
		console.log(error);
	});
}

function getExpiration(token) {
	const { exp } = JSON.parse(
		Buffer.from(token.split(".")[1], "base64").toString("utf8")
	);

	const now = new Date();
	const expires = new Date(exp * 1000);

	return {
		expires: expires,
		expired: expires < now,
		expiresInDays: Math.floor((expires - now) / 1000 / 60 / 60 / 24),
		expiresInHours: Math.floor((expires - now) / 1000 / 60 / 60),
		expiresInMinutes: Math.floor((expires - now) / 1000 / 60),
		expiresInSeconds: Math.floor((expires - now) / 1000),
		expiresInMilliseconds: expires - now,
	};
}

module.exports.getExpiration = getExpiration;
module.exports.startWithQR = util.promisify(startWithQR);
