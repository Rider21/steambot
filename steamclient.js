const { EmbedBuilder } = require('discord.js');
const SteamUser = require('steam-user');
const path = require('path');
const { bbcodeToMarkdown } = require(path.join(__dirname, 'utils'));

async function buildBot(config, game, files, webhookClient) {
  const bot = new SteamUser({
    dataDirectory: './sentry',
    //singleSentryfile: false,
    autoRelogin: true,
    renewRefreshTokens: true
  });
  let timeoutID = null;

  bot.on('loggedOn', details => {
    webhookClient.send({
      avatarURL: bot.users?.[config.steamID]?.avatar_url_full,
      username: config.accountName,
      content: `[${config.accountName}] Вошёл в Steam ${bot.steamID.getSteam3RenderedID()}`
    });
    bot.setPersona(SteamUser.EPersonaState?.[config?.status] || SteamUser.EPersonaState.Invisible);
  });

  bot.on('disconnected', (e, msg) => {
    if (timeoutID?._destroyed == false) {
      clearTimeout(timeoutID);
    }
    console.log('[' + config.accountName + '] ' + msg);
    webhookClient.send({
      avatarURL: bot.users?.[config.steamID]?.avatar_url_full,
      username: config.accountName,
      content: `[${config.accountName}] ${msg}`
    });
  });

  bot.on('error', e => {
    if (timeoutID?._destroyed == false) {
      clearTimeout(timeoutID);
    }
    console.log('[' + config.accountName + '] ' + e);
    webhookClient.send({
      avatarURL: bot.users?.[config.steamID]?.avatar_url_full,
      username: config.accountName,
      content: `[${config.accountName}] ${e}`
    });

    setTimeout(
      async () =>
        await bot.logOn({
          refreshToken: config.refreshToken,
          steamID: config.steamID
        }),
      getRandomNumber(15 * 60 * 1000, 60 * 60 * 1000)
    );
  });

  bot.on('steamGuard', (domain, callback, lastCodeWrong) => {
    webhookClient.send({
      avatarURL: bot.users?.[config.steamID]?.avatar_url_full,
      username: config.accountName,
      content: `[${config.accountName}] Нужен код авторизации`
    });
  });

  bot.chat.on('friendMessage', msg => {
    let steam64 = msg.steamid_friend.toString();
    let embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('Сообщение')
      .setAuthor({
        name: bot.users?.[steam64]?.player_name || steam64,
        iconURL: bot.users?.[steam64]?.avatar_url_full,
        url: 'https://steamcommunity.com/profiles/' + steam64
      })
      .setTimestamp(msg?.server_timestamp)
      .setFooter({
        text: config.accountName,
        iconURL: bot.users?.[config.steamID]?.avatar_url_full
      });
    let forwarding = bbcodeToMarkdown(msg?.message_bbcode_parsed || []);
    embed.setDescription(forwarding?.text || msg?.message_no_bbcode || msg?.message);
    if (forwarding?.image) {
      embed.setImage(forwarding.image);
    }

    webhookClient.send({
      avatarURL: bot.users?.[config.steamID]?.avatar_url_full,
      username: config.accountName,
      embeds: [embed]
    });
  });

  bot.on('playingState', (blocked, playingApp) => {
    if (!blocked && playingApp == 0) {
      if (timeoutID?._destroyed || timeoutID == null) {
        timeoutID = setTimeout(
          () => {
            console.log(`[${config.accountName}] Зашел в игру`);
            webhookClient.send({
              avatarURL: bot.users?.[config.steamID]?.avatar_url_full,
              username: config.accountName,
              content: `[${config.accountName}] Зашел в игру`
            });
            bot.gamesPlayed(config?.game || game);
          },
          getRandomNumber(3 * 60 * 1000, 15 * 60 * 1000)
        );
      }
    } else if (timeoutID?._destroyed == false) {
      clearTimeout(timeoutID);
    }
  });

  bot.on('refreshToken', async token => {
    config.refreshToken = token;
    await config.save();
  });

  bot.storage.on('save', async (filename, contents, callback) => {
    await files.updateOne(
      { filename },
      { filename, content: contents.toString('base64') },
      { upsert: true }
    );
  });

  bot.storage.on('read', (filename, callback) =>
    files
      .findOne({ filename })
      .then(file => callback(null, file?.content ? Buffer.from(file.content, 'base64') : undefined))
      .catch(err => callback(err))
  );

  await bot.logOn({
    refreshToken: config.refreshToken,
    steamID: config.steamID
  });

  return bot;
}

function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

module.exports.buildBot = buildBot;
