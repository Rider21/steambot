const { LoginSession, EAuthTokenPlatformType } = require('steam-session');
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const QRCode = require('qrcode');
const util = require('util');

async function startWithQR(webhook, msg, callback) {
  const embed = new EmbedBuilder()
    .setTitle('Авторизация')
    .setDescription(
      'Создан QR-код.\nПожалуйста, отсканируйте его с помощью приложения Steam Mobile Authenticator.'
    )
    .setColor(0x00ffff)
    .setTimestamp()
    .setImage('attachment://qrcode.png');

  const session = new LoginSession(EAuthTokenPlatformType.SteamClient);
  const qrCodeData = await session.startWithQR();
  callback = typeof msg == 'function' ? msg : callback;
  msg = typeof msg == 'string' ? msg : null;
  if (msg) {
    webhook.editMessage(msg, {
      embeds: [embed],
      files: [
        new AttachmentBuilder(await QRCode.toBuffer(qrCodeData.qrChallengeUrl), {
          name: 'qrcode.png'
        })
      ]
    });
  } else {
    msg = await webhook.send({
      embeds: [embed],
      files: [
        new AttachmentBuilder(await QRCode.toBuffer(qrCodeData.qrChallengeUrl), {
          name: 'qrcode.png'
        })
      ]
    });
  }

  session.on('authenticated', () => {
    let embed1 = new EmbedBuilder()
      .setTitle('Авторизация')
      .setDescription(session?.accountName + ', аутентификация прошла успешно!')
      .setColor(0x00ffff)
      .setTimestamp();

    webhook.editMessage(msg?.id || msg, {
      embeds: [embed1],
      files: []
    });
    console.log('Аутентификация прошла успешно!');
    callback(null, {
      accountName: session?.accountName,
      refreshToken: session?.refreshToken,
      steamID: session?.steamID?.toString?.()
    });
  });

  session.on('remoteInteraction', () => {
    let embed1 = new EmbedBuilder()
      .setTitle('Авторизация')
      .setDescription(
        'Код отсканирован!\nПожалуйста, подтвердите запрос на вход в систему в приложении Steam Mobile Authenticator.'
      )
      .setColor(0x00ffff)
      .setTimestamp();

    webhook.editMessage(msg?.id || msg, {
      embeds: [embed1],
      files: []
    });
  });

  session.on('timeout', () => startWithQR(webhook, msg?.id || msg, callback));

  session.on('error', error => {
    console.log(error);
  });
}

function getExpiration(token) {
  const { exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));

  const now = new Date();
  const expires = new Date(exp * 1000);

  return {
    expires: expires,
    expired: expires < now,
    expiresInDays: Math.floor((expires - now) / 1000 / 60 / 60 / 24),
    expiresInHours: Math.floor((expires - now) / 1000 / 60 / 60),
    expiresInMinutes: Math.floor((expires - now) / 1000 / 60),
    expiresInSeconds: Math.floor((expires - now) / 1000),
    expiresInMilliseconds: expires - now
  };
}

function escapeSymbols(str) {
  return str.replace(/[|*~>\\_`]/g, matched => '\\' + matched);
}

function bbcodeToMarkdown(msg) {
  let image;
  let result = msg.map(item => {
    switch (item?.tag) {
      case 'img':
        image = item.attrs?.thumbnail_src.endsWith('.gif')
          ? item.attrs?.thumbnail_src //исправление отображения gif от giphy
          : item.attrs.src;
        if (item.attrs.giphy_search) {
          return `/giphy ${item.attrs.giphy_search}\n${item.attrs.title}`;
        }
        return item.attrs.src;
      case 'spoiler':
        let otvet = bbcodeToMarkdown(item.content);
        if (otvet?.image) image = otvet.image;
        return '||' + otvet.text + '||';
      case 'code':
        return '```\n' + item.content[0].replace(/`/g, '\\`');
        +'```';
      case 'pre':
        return '`' + escapeSymbols(item.content[0]) + '`';
      case 'quote':
        return '> ' + escapeSymbols(item.content[0]).replace(/\n/g, '\n> ');
      case 'flip':
        return `/flip: **${item.attrs.result == 'heads' ? 'ОРЁЛ' : 'РЕШКА'}**`;
      case 'random':
        return `/random: ${item.attrs.min} - ${item.attrs.max} : **${item.attrs.result}**`;
      case 'url':
        return item.attrs.src;
      case 'emoticon':
        if (!image)
          image = encodeURI(
            'https://community.cloudflare.steamstatic.com/economy/sticker/' + item.attrs.type
          );
        return ':' + item.content[0] + ':';
      case 'sticker':
        image = encodeURI(
          'https://community.cloudflare.steamstatic.com/economy/sticker/' + item.attrs.type
        );
        return `[:${item.attrs.type}:](${image})`;
      case 'og':
        if (item.attrs.img) image = item.attrs.img;
        return `${item.attrs.title}\n${item.attrs.desc}\n${item.attrs.url}`;
      default:
        if (item?.tag) {
          console.log(item.tag, item.content[0]);
        }
        if (typeof item === 'string') {
          return escapeSymbols(item);
        }
        return item;
        break;
    }
  });
  return { text: result.join(''), image };
}

module.exports.getExpiration = getExpiration;
module.exports.bbcodeToMarkdown = bbcodeToMarkdown;
module.exports.startWithQR = util.promisify(startWithQR);
