const SteamUser = require("steam-user");

async function buildBot(config, game, files, webhookClient) {
  const bot = new SteamUser({
    //dataDirectory: "./sentry",
    //singleSentryfile: false,
    autoRelogin: true,
    rememberPassword: true,
  });

  bot.on("loggedOn", (details) => {
    webhookClient.send({
      content: `[${config.accountName}] Вошёл в Steam ${bot.steamID.getSteam3RenderedID()}`,
      username: config.accountName,
    });
    bot.gamesPlayed(config?.game || game);
    bot.setPersona(config?.status || SteamUser.EPersonaState.Offline);
  });

  bot.on("disconnected", (e, msg) => {
    console.log("[" + config.accountName + "] " + msg);
    webhookClient.send({
      content: `[${config.accountName}] ${msg}`,
      username: config.accountName,
    });
  });

  bot.on("error", (e) => {
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

  bot.on("steamGuard", (domain, callback, lastCodeWrong) => {
    webhookClient.send({
      content: `[${config.accountName}] Нужен код авторизации`,
      username: config.accountName,
    });
  });

  bot.on("friendMessage", (steamID, message) => {
    webhookClient.send({
      content: `[${config.accountName}] Сообщение от ${steamID}: ${message}`,
      username: config.accountName,
    });
  });

  bot.storage.on("save", async (filename, contents, callback) => {
    await files.updateOne(
      { filename },
      { filename, content: contents.toString("base64") },
      { upsert: true }
    );
  });

  bot.storage.on("read", (filename, callback) => {
    files
      .findOne({ filename })
      .then((file) => callback(null, file?.content ? Buffer.from(file.content, "base64") : undefined))
      .catch((err) => callback(err));
  });

  await bot.logOn({
    refreshToken: config.refreshToken,
    steamID: config.steamID,
  });

  return bot;
}

module.exports.buildBot = buildBot;
