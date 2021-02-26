require(`dotenv`).config();

const discordAPI = require(`./discordAPI`);
const redisAPI = require(`./redisApi`);
const format = require(`./format`);
const utils = require(`./utils`);

const adminTag = process.env.ADMIN_TAG;

const today = {
  command: utils.addDevPrefix(`!totd today`),
  action: async (msg, client) => {
    try {
      await discordAPI.sendTOTDMessage(client, msg.channel, await discordAPI.getTOTDMessage());
    } catch (error) {
      discordAPI.sendErrorMessage(msg.channel);
      console.log(error);
    }
  }
};

const leaderboard = {
  command: utils.addDevPrefix(`!totd leaderboard`),
  action: async (msg, client) => {
    try {
      await discordAPI.sendTOTDLeaderboard(client, msg.channel);
    } catch (error) {
      discordAPI.sendErrorMessage(msg.channel);
      console.log(error);
    }
  }
};

// debug command to see the current ratings
const ratings = {
  command: utils.addDevPrefix(`!totd ratings`),
  action: async (msg, client) => {
    if (msg.author.tag === adminTag) { // admin only, verdict is public (for yesterday's track)
      try {
        await discordAPI.sendTOTDRatings(client, msg.channel);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.log(error);
      }
    }
  }
};

const verdict = {
  command: utils.addDevPrefix(`!totd verdict`),
  action: async (msg, client) => {
    try {
      await discordAPI.sendTOTDRatings(client, msg.channel, true);
    } catch (error) {
      discordAPI.sendErrorMessage(msg.channel);
      console.log(error);
    }
  }
};

const enable = {
  command: utils.addDevPrefix(`!totd enable`),
  action: async (msg) => {
    if (msg.member.hasPermission(`ADMINISTRATOR`) || msg.author.tag === adminTag) {
      try {
        const redisClient = await redisAPI.login();
        await redisAPI.addConfig(redisClient, msg.guild.id, msg.channel.id);
        redisAPI.logout(redisClient);
        msg.channel.send(`You got it, I'll post the TOTD every day just after it comes out.`);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.log(error);
      }
    } else {
      msg.channel.send(`You don't have \`ADMINISTRATOR\` permission, sorry.`);
    }
  }
};

const disable = {
  command: utils.addDevPrefix(`!totd disable`),
  action: async (msg) => {
    if (msg.member.hasPermission(`ADMINISTRATOR`) || msg.author.tag === adminTag) {
      try {
        const redisClient = await redisAPI.login();
        await redisAPI.removeConfig(redisClient, msg.guild.id);
        redisAPI.logout(redisClient);
        msg.channel.send(`Alright, I'll stop posting from now on.`);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.log(error);
      }
    } else {
      msg.channel.send(`You don't have \`ADMINISTRATOR\` permissions, sorry.`);
    }
  }
};

const bingo = {
  command: utils.addDevPrefix(`!totd bingo`),
  action: async (msg) => {
    try {
      await discordAPI.sendBingoBoard(msg.channel);
    } catch (error) {
      discordAPI.sendErrorMessage(msg.channel);
      console.log(error);
    }
  }
};

const help = {
  command: utils.addDevPrefix(`!totd help`),
  action: async (msg) => {
    const message = `\`${utils.addDevPrefix(`!totd today`)}\`  -  Displays the current TOTD information.\n \
      \`${utils.addDevPrefix(`!totd leaderboard`)}\`  -  Display the current top 10 (and the time for top 100).\n \
      \`${utils.addDevPrefix(`!totd verdict`)}\`  -  Display yesterday's TOTD ratings.\n \
      \`${utils.addDevPrefix(`!totd bingo`)}\`  -  Display this week's bingo board.\n \
      \`${utils.addDevPrefix(`!totd enable`)}\`  -  Enables daily TOTD posts in this channel (admin only).\n \
      \`${utils.addDevPrefix(`!totd disable`)}\`  -  Disables the daily posts again (admin only).\n \
      \`${utils.addDevPrefix(`!totd help`)}\`  -  You're looking at it.`;
    const formattedMessage = format.formatHelpMessage(message);
    msg.channel.send(formattedMessage);
  }
};

const refresh = {
  command: utils.addDevPrefix(`!totd refresh today`),
  action: async (msg) => {
    if (msg.author.tag === adminTag) {
      try {
        await discordAPI.getTOTDMessage(true);
        msg.channel.send(`I've refreshed the current TOTD data!`);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

const refreshLeaderboard = {
  command: utils.addDevPrefix(`!totd refresh leaderboard`),
  action: async (msg) => {
    if (msg.author.tag === adminTag) {
      try {
        await discordAPI.getTOTDLeaderboardMessage(true);
        msg.channel.send(`I've refreshed the current leaderboard data!`);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

const refreshRatings = {
  command: utils.addDevPrefix(`!totd refresh ratings`),
  action: async (msg) => {
    if (msg.author.tag === adminTag) {
      try {
        const redisClient = await redisAPI.login();
        await redisAPI.clearTOTDRatings(redisClient);
        redisAPI.logout(redisClient);
        msg.channel.send(`I've refreshed the current rating data!`);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

const refreshBingo = {
  command: utils.addDevPrefix(`!totd refresh bingo`),
  action: async (msg) => {
    if (msg.author.tag === adminTag) {
      try {
        await discordAPI.getBingoMessage(true);
        msg.channel.send(`I've refreshed the current bingo board!`);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

const debug = {
  command: utils.addDevPrefix(`!totd debug`),
  action: async (msg, client) => {
    if (msg.author.tag === adminTag) {
      try {
        await discordAPI.distributeTOTDMessages(client);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

module.exports = [
  help,
  refresh,
  refreshLeaderboard,
  refreshRatings,
  refreshBingo,
  debug,
  today,
  leaderboard,
  ratings,
  verdict,
  enable,
  disable,
  bingo
];
