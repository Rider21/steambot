require("dotenv").config();
require("./keep_alive.js");

const { WebhookClient } = require("discord.js");
const mongoose = require("mongoose");
const path = require("path");

const utils = require(path.join(__dirname, "utils"));
const steamclient = require(path.join(__dirname, "steamclient.js")).buildBot;
mongoose.connect(process.env.mongodbUri);

const webhookClient = new WebhookClient({ url: process.env.webhook });
const max = parseInt(process.env.max, 10);
const games = JSON.parse(process.env.games);
const bots = [];

const account = mongoose.model("settings", {
  refreshToken: String,
  steamID: String,
  accountName: String,
});

const files = mongoose.model("files", {
  filename: String,
  content: String,
});

(async () => {
  const acc = await account.find({});
  for (let i = 0; i < max; i++) {
    if (acc[i]?.refreshToken && !utils.getExpiration(acc[i].refreshToken).expired) {
      bots.push(await steamclient(acc[i], games[i], files, webhookClient));
    } else {
      newAcc = await utils.startWithQR(webhookClient);
      await account.updateOne(
        { accountName: newAcc.accountName }, newAcc, { upsert: true }
      );
      acc[i] = newAcc;
      i--;
    }
  }
})();
