require(`dotenv`).config();

const discordAPI = require(`./discordAPI`);
const redisAPI = require(`./redisApi`);
const format = require(`./format`);
const utils = require(`./utils`);
const constants = require(`./constants`);

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

const verdict = {
  command: [utils.addDevPrefix(`!totd verdict`), utils.addDevPrefix(`!totd yesterday`)],
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

const setRole = {
  command: utils.addDevPrefix(`!totd set role`),
  action: async (msg) => {
    if (msg.member.hasPermission(`ADMINISTRATOR`) || msg.author.tag === adminTag) {
      try {
        const redisClient = await redisAPI.login();
        const configs = await redisAPI.getAllConfigs(redisClient);
        // check if this server already has daily posts set up
        const matchingConfig = configs.find((config) => config.serverID === msg.guild.id);
        if (matchingConfig) {
          const role = msg.content.split(` `)[3];
          if (role.startsWith(`<@&`)) {
            const region = msg.content.split(` `)[4];
            // valid regions: "Europe" (7pm), "America" (3am), "Asia" (11am)
            if (region) {
              const regions = constants.cupRegions;
              if (
                region === regions.europe
                || region === regions.america
                || region === regions.asia
              ) {
                await redisAPI.addRole(redisClient, msg.guild.id, role, region);
                msg.channel.send(`Okay, from now on I'll ping that role ten minutes before the ${region} COTD starts.`);
              } else {
                const message1 = `Sorry, I only know three regions: \`${regions.europe}\`, \`${regions.america}\`, and \`${regions.asia}\` - `;
                const message2 = `tell me to set up a role for a region by using \`${utils.addDevPrefix(`!totd set role @[role] [region]`)}\`.\n`;
                const message3 = `If you just want to set up pings for the main Europe event, you can leave out the region.`;
                msg.channel.send(`${message1}${message2}${message3}`);
              }
            } else {
              await redisAPI.addRole(redisClient, msg.guild.id, role);
              msg.channel.send(`Okay, from now on I'll ping that role ten minutes before the main COTD starts.`);
            }
          } else {
            msg.channel.send(`Sorry, I only understand roles that look like \`@role\` - and I obviously don't accept user IDs either.`);
          }
        } else {
          msg.channel.send(`Sorry, you'll need to enable the daily posts first.`);
        }
        redisAPI.logout(redisClient);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.log(error);
      }
    } else {
      msg.channel.send(`You don't have \`ADMINISTRATOR\` permissions, sorry.`);
    }
  }
};

const removeRole = {
  command: utils.addDevPrefix(`!totd remove role`),
  action: async (msg) => {
    if (msg.member.hasPermission(`ADMINISTRATOR`) || msg.author.tag === adminTag) {
      try {
        const redisClient = await redisAPI.login();
        const region = msg.content.split(` `)[3];
        if (region) {
          const regions = constants.cupRegions;
          if (
            region === regions.europe
            || region === regions.america
            || region === regions.asia
          ) {
            await redisAPI.removeRole(redisClient, msg.guild.id, region);
            msg.channel.send(`Okay, I'll stop the pings for the ${region} COTD.`);
          } else {
            const message1 = `Sorry, I only know three regions: \`${regions.europe}\`, \`${regions.america}\`, and \`${regions.asia}\`.\n`;
            const message2 = `Tell me to remove a role for a region by using \`${utils.addDevPrefix(`!totd remove role [region]`)}\`.`;
            msg.channel.send(`${message1}${message2}`);
          }
        } else {
          await redisAPI.removeRole(redisClient, msg.guild.id);
          msg.channel.send(`Okay, I'll stop the pings for the main COTD.`);
        }
        redisAPI.logout(redisClient);
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

const lastBingo = {
  command: utils.addDevPrefix(`!totd last bingo`),
  action: async (msg) => {
    try {
      await discordAPI.sendBingoBoard(msg.channel, true);
    } catch (error) {
      discordAPI.sendErrorMessage(msg.channel);
      console.log(error);
    }
  }
};

const bingoVote = {
  command: utils.addDevPrefix(`!totd vote`),
  action: async (msg) => {
    try {
      const bingoID = msg.content.split(` `)[2];
      if (!bingoID || Number.isNaN(parseInt(bingoID))) {
        msg.channel.send(`I didn't catch that - to vote on a bingo field, use \`!totd vote [1-25]\`.`);
      } else {
        await discordAPI.sendBingoVote(msg.channel, parseInt(bingoID));
      }
    } catch (error) {
      discordAPI.sendErrorMessage(msg.channel);
      console.error(error);
    }
  }
};

const help = {
  command: utils.addDevPrefix(`!totd help`),
  action: async (msg) => {
    let message = `\`${utils.addDevPrefix(`!totd today`)}\`  -  Display the current TOTD information.\n \
      \`${utils.addDevPrefix(`!totd leaderboard`)}\`  -  Display the current top 10 (and the time for top 100).\n \
      \`${utils.addDevPrefix(`!totd verdict`)}\`  -  Display yesterday's TOTD ratings.\n \
      \`${utils.addDevPrefix(`!totd ratings`)}\`  -  Display today's TOTD ratings.\n \
      \`${utils.addDevPrefix(`!totd bingo`)}\`  -  Display this week's bingo board.\n \
      \`${utils.addDevPrefix(`!totd last bingo`)}\`  -  Display last week's bingo board.\n \
      \`${utils.addDevPrefix(`!totd vote [1-25]`)}\`  -  Start a vote to cross off that bingo field.`;

    let adminMessage;
    if (msg.member.hasPermission(`ADMINISTRATOR`) || msg.author.tag === adminTag) {
      adminMessage = `\n\`${utils.addDevPrefix(`!totd enable`)}\`  -  Enable daily TOTD posts in this channel.\n \
      \`${utils.addDevPrefix(`!totd disable`)}\`  -  Disable the daily posts again.\n \
      \`${utils.addDevPrefix(`!totd set role [@role] [region]`)}\`  -  Enable pings ten minutes before COTD.\n \
      \`${utils.addDevPrefix(`!totd remove role [region]`)}\`  -  Disable daily pings again.\n\
      (Supported regions: \`${constants.cupRegions.europe}\`, \`${constants.cupRegions.america}\`, and \`${constants.cupRegions.asia}\`)`;
    }
    try {
      const formattedMessage = format.formatHelpMessage(message, adminMessage);
      await msg.channel.send(formattedMessage);
    } catch (error) {
      discordAPI.sendErrorMessage(msg.channel);
      console.log(error);
    }
  }
};

const invite = {
  command: utils.addDevPrefix(`!totd invite`),
  action: async (msg) => {
    try {
      await msg.channel.send(format.formatInviteMessage());
    } catch (error) {
      discordAPI.sendErrorMessage(msg.channel);
      console.log(error);
    }
  }
};

// command to see the current ratings
const ratings = {
  command: [utils.addDevPrefix(`!totd ratings`), utils.addDevPrefix(`!totd rating`)],
  action: async (msg, client) => {
    try {
      await discordAPI.sendTOTDRatings(client, msg.channel);
    } catch (error) {
      discordAPI.sendErrorMessage(msg.channel);
      console.log(error);
    }
  }
};

const rankings = {
  command: [utils.addDevPrefix(`!totd rankings`), utils.addDevPrefix(`!totd ranking`)],
  action: async (msg) => {
    // temporarily disable this until the prod data has been manually updated
    if (msg.author.tag === adminTag) {
      try {
        // use the length of the longer command (cause the extra character is just a space that doesn't get trimmed)
        const timeframe = msg.content.substr(utils.addDevPrefix(`!totd rankings`).length).trim();
        const validTimeframes = [
          {label: `month`, value: constants.ratingRankingType.monthly},
          {label: `this month`, value: constants.ratingRankingType.monthly},
          {label: `last month`, value: constants.ratingRankingType.lastMonthly},
          {label: `all-time`, value: constants.ratingRankingType.allTime},
          {label: `all time`, value: constants.ratingRankingType.allTime}
        ];
        let matchingTimeframe = validTimeframes[0]; // monthly is default

        validTimeframes.forEach((validTimeframe) => {
          if (timeframe.startsWith(validTimeframe.label.toLowerCase())) {
            matchingTimeframe = validTimeframe;
          }
        });

        const redisClient = await redisAPI.login();
        const rankings = await redisAPI.getRatingRankings(redisClient, matchingTimeframe.value);
        redisAPI.logout(redisClient);

        const rankingMessage = format.formatRankingMessage(rankings, matchingTimeframe);
        await msg.channel.send(rankingMessage);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.log(error);
      }
    }
  }
};

const refresh = {
  command: utils.addDevPrefix(`!totd refresh today`),
  action: async (msg) => {
    if (msg.author.tag === adminTag) {
      try {
        await discordAPI.getTOTDMessage(true);
        await msg.channel.send(`I've refreshed the current TOTD data!`);
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
        await msg.channel.send(`I've refreshed the current leaderboard data!`);
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
        await msg.channel.send(`I've refreshed the current rating data!`);
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
        await msg.channel.send(`I've refreshed the current bingo board!`);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

const bingoCount = {
  command: utils.addDevPrefix(`!totd refresh count`),
  action: async (msg, client) => {
    if (msg.author.tag === adminTag) {
      try {
        await discordAPI.countBingoVotes(client);
        await msg.channel.send(`I've counted and resolved the current bingo votes!`);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

const setAdminServer = {
  command: utils.addDevPrefix(`!totd set admin`),
  action: async (msg) => {
    if (msg.author.tag === adminTag) {
      try {
        const redisClient = await redisAPI.login();
        await redisAPI.setAdminServer(redisClient, msg.guild.id, msg.channel.id);
        redisAPI.logout(redisClient);
        await msg.channel.send(`Alright, this is now the admin server!`);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

const removeAdminServer = {
  command: utils.addDevPrefix(`!totd remove admin`),
  action: async (msg) => {
    if (msg.author.tag === adminTag) {
      try {
        const redisClient = await redisAPI.login();
        await redisAPI.setAdminServer(redisClient, null);
        redisAPI.logout(redisClient);
        await msg.channel.send(`I've removed the admin server configuration!`);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

const serverInfo = {
  command: utils.addDevPrefix(`!totd servers`),
  action: async (msg, client) => {
    if (msg.author.tag === adminTag) {
      try {
        const servers = [];
        client.guilds.cache.forEach(async (guild) => {
          servers.push(guild);
        });
        await msg.channel.send(`I'm currently in ${servers.length} servers and counting!`);

        // fetch and log detailed infos asynchronously
        servers.forEach(async (server) => {
          const owner = await client.users.fetch(server.ownerID);
          console.log(`Server: ${server.name} - Owner: ${JSON.stringify(owner.tag)} - ID: ${server.id}`);
        });
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

const debug = {
  command: utils.addDevPrefix(`!totd debug`),
  action: async (msg) => {
    if (msg.author.tag === adminTag) {
      try {
        await msg.channel.send(`Debug me!`);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

module.exports = [
  help,
  invite,
  refresh,
  refreshLeaderboard,
  refreshRatings,
  refreshBingo,
  debug,
  today,
  leaderboard,
  ratings,
  rankings,
  verdict,
  enable,
  disable,
  setRole,
  removeRole,
  bingo,
  lastBingo,
  bingoVote,
  bingoCount,
  setAdminServer,
  removeAdminServer,
  serverInfo
];
