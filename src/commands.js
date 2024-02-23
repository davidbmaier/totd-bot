require(`dotenv`).config();

const discordAPI = require(`./discordAPI`);
const redisAPI = require(`./redisApi`);
const format = require(`./format`);
const utils = require(`./utils`);
const constants = require(`./constants`);

const luxon = require(`luxon`);

const adminTag = process.env.ADMIN_TAG;

const today = {
  slashCommand: {
    name: `today`,
    description: `Display the current Track of the Day`,
    type: `CHAT_INPUT`,
  },
  action: async (msg, client) => {
    try {
      await discordAPI.sendTOTDMessage(client, msg.channel, await discordAPI.getTOTDMessage(), msg);
    } catch (error) {
      discordAPI.sendErrorMessage(msg.channel);
      console.log(error);
    }
  }
};

const leaderboard = {
  slashCommand: {
    name: `leaderboard`,
    description: `Display the current TOTD leaderboard and trophy thresholds.`,
    type: `CHAT_INPUT`,
  },
  action: async (msg, client) => {
    try {
      await discordAPI.sendTOTDLeaderboard(client, msg.channel, msg);
    } catch (error) {
      discordAPI.sendErrorMessage(msg.channel);
      console.log(error);
    }
  }
};

// command to see the current ratings
const ratings = {
  slashCommand: {
    name: `ratings`,
    description: `Display a TOTD's ratings.`,
    type: `CHAT_INPUT`,
    options: [
      {
        type: `STRING`,
        name: `totd`,
        description: `A Track of the Day (that there are ratings for).`,
        required: true,
        autocomplete: true
      },
    ]
  },
  action: async (msg, client) => {
    if (msg.isAutocomplete()) {
      try {
        const redisClient = await redisAPI.login();

        const focusedValue = msg.options.getFocused();
        if (focusedValue === ``) {
          const today = await redisAPI.getCurrentTOTD(redisClient);
          const yesterday = await redisAPI.getPreviousTOTD(redisClient);
          const response = [
            {name: `Today's TOTD (${utils.removeNameFormatting(today.name)} by ${today.authorName})`, value: today.mapUid},
            {name: `Yesterday's TOTD (${utils.removeNameFormatting(yesterday.name)} by ${yesterday.authorName})`, value: yesterday.mapUid},
            {name: `Or just start typing to search for a previous TOTD...`, value: ``}
          ];
          await msg.respond(response);
        } else {
          const storedTOTDs = await redisAPI.getAllStoredTOTDs(redisClient);
          const options = Object.entries(storedTOTDs).reverse().map(
            ([mapUid, map]) => ({ name: `${utils.removeNameFormatting(map.name)} by ${map.authorName} (${map.month} ${utils.formatDay(map.day)} ${map.year})`, value: mapUid })).filter((option) => option.name.toLowerCase().includes(focusedValue.toLowerCase())
          );
          await msg.respond(options.slice(0, 25));
        }
        redisAPI.logout(redisClient);
      } catch (error) {
        console.error(error);
      }
    } else {
      try {
        const mapUid = msg.options.get(`totd`).value;
        if (mapUid === ``) {
          utils.sendMessage(msg.channel, `You'll have to select an actual TOTD if you want to see some ratings.`, msg);
          return;
        }
        await discordAPI.sendTOTDRatings(client, msg.channel, mapUid, msg);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.log(error);
      }
    }
  }
};

const enable = {
  slashCommand: {
    name: `enable`,
    description: `Enable daily posts in this channel when the new TOTD is released.`,
    type: `CHAT_INPUT`,
  },
  action: async (msg) => {
    if (msg.member.permissions.has(`ADMINISTRATOR`) || utils.checkMessageAuthorForTag(msg, adminTag)) {
      try {
        const redisClient = await redisAPI.login();
        await redisAPI.addConfig(redisClient, msg.guild.id, msg.channel.id);
        redisAPI.logout(redisClient);
        utils.sendMessage(msg.channel, `You got it, I'll post the TOTD every day just after it comes out.`, msg);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.log(error);
      }
    } else {
      utils.sendMessage(msg.channel, `You don't have \`ADMINISTRATOR\` permission, sorry.`, msg);
    }
  }
};

const disable = {
  slashCommand: {
    name: `disable`,
    description: `Disable daily TOTD posts again.`,
    type: `CHAT_INPUT`,
  },
  action: async (msg) => {
    if (msg.member.permissions.has(`ADMINISTRATOR`) || utils.checkMessageAuthorForTag(msg, adminTag)) {
      try {
        const redisClient = await redisAPI.login();
        await redisAPI.removeConfig(redisClient, msg.guild.id);
        redisAPI.logout(redisClient);
        utils.sendMessage(msg.channel, `Alright, I'll stop posting from now on.`, msg);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.log(error);
      }
    } else {
      utils.sendMessage(msg.channel, `You don't have \`ADMINISTRATOR\` permissions, sorry.`, msg);
    }
  }
};

const setRole = {
  slashCommand: {
    name: `enablepings`,
    description: `Enable reminder pings for a role ten minutes before COTD.`,
    type: `CHAT_INPUT`,
    options: [
      {
        type: `STRING`,
        name: `role`,
        description: `The role that should be pinged. Format: @role`,
        required: true,
      },
      {
        type: `STRING`,
        name: `region`,
        description: `The region that the role should be pinged for.`,
        required: true,
        choices: [
          {
            name: constants.cupRegions.europe,
            value: constants.cupRegions.europe
          },
          {
            name: constants.cupRegions.america,
            value: constants.cupRegions.america
          },
          {
            name: constants.cupRegions.asia,
            value: constants.cupRegions.asia
          },
        ]
      }
    ]
  },
  action: async (msg, client, commandIDs) => {
    if (msg.member.permissions.has(`ADMINISTRATOR`) || utils.checkMessageAuthorForTag(msg, adminTag)) {
      try {
        const redisClient = await redisAPI.login();
        const configs = await redisAPI.getAllConfigs(redisClient);
        // check if this server already has daily posts set up
        const matchingConfig = configs.find((config) => config.serverID === msg.guild.id);
        if (matchingConfig) {
          const role = msg.options.get(`role`).value;
          if (role.startsWith(`<@&`)) {
            const region = msg.options.get(`region`).value;
            // valid regions: "Europe" (7pm), "America" (3am), "Asia" (11am)
            if (region) {
              const regions = constants.cupRegions;
              if (
                region === regions.europe
                || region === regions.america
                || region === regions.asia
              ) {
                await redisAPI.addRole(redisClient, msg.guild.id, role, region);
                utils.sendMessage(msg.channel, `Okay, from now on I'll ping that role ten minutes before the ${region} COTD starts.`, msg);
              } else {
                const message1 = `Sorry, I only know three regions: \`${regions.europe}\`, \`${regions.america}\`, and \`${regions.asia}\` - `;
                const message2 = `tell me to set up a role for a region by using ${utils.formatCommand(`enablepings`, commandIDs)}.\n`;
                const message3 = `If you just want to set up pings for the main Europe event, you can leave out the region.`;
                utils.sendMessage(msg.channel, `${message1}${message2}${message3}`, msg);
              }
            } else {
              await redisAPI.addRole(redisClient, msg.guild.id, role);
              utils.sendMessage(msg.channel, `Okay, from now on I'll ping that role ten minutes before the main COTD starts.`, msg);
            }
          } else {
            utils.sendMessage(msg.channel, `Sorry, I only understand roles that look like \`@role\` - and I obviously don't accept user IDs either.`, msg);
          }
        } else {
          utils.sendMessage(msg.channel, `Sorry, you'll need to enable the daily posts first.`, msg);
        }
        redisAPI.logout(redisClient);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.log(error);
      }
    } else {
      utils.sendMessage(msg.channel, `You don't have \`ADMINISTRATOR\` permissions, sorry.`, msg);
    }
  }
};

const removeRole = {
  slashCommand: {
    name: `disablepings`,
    description: `Disable TOTD reminder pings for a role.`,
    type: `CHAT_INPUT`,
    options: [
      {
        type: `STRING`,
        name: `region`,
        description: `The region that the role should be pinged for.`,
        required: true,
        choices: [
          {
            name: constants.cupRegions.europe,
            value: constants.cupRegions.europe
          },
          {
            name: constants.cupRegions.america,
            value: constants.cupRegions.america
          },
          {
            name: constants.cupRegions.asia,
            value: constants.cupRegions.asia
          },
        ]
      }
    ]
  },
  action: async (msg, client, commandIDs) => {
    if (msg.member.permissions.has(`ADMINISTRATOR`) || utils.checkMessageAuthorForTag(msg, adminTag)) {
      try {
        const redisClient = await redisAPI.login();
        const region = msg.options.get(`region`).value;
        if (region) {
          const regions = constants.cupRegions;
          if (
            region === regions.europe
            || region === regions.america
            || region === regions.asia
          ) {
            await redisAPI.removeRole(redisClient, msg.guild.id, region);
            utils.sendMessage(msg.channel, `Okay, I'll stop the pings for the ${region} COTD.`, msg);
          } else {
            const message1 = `Sorry, I only know three regions: \`${regions.europe}\`, \`${regions.america}\`, and \`${regions.asia}\`.\n`;
            const message2 = `Tell me to remove a role for a region by using ${utils.formatCommand(`disablepings`, commandIDs)}.`;
            utils.sendMessage(msg.channel, `${message1}${message2}`, msg);
          }
        } else {
          await redisAPI.removeRole(redisClient, msg.guild.id);
          utils.sendMessage(msg.channel, `Okay, I'll stop the pings for the main COTD.`, msg);
        }
        redisAPI.logout(redisClient);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.log(error);
      }
    } else {
      utils.sendMessage(msg.channel, `You don't have \`ADMINISTRATOR\` permissions, sorry.`, msg);
    }
  }
};

const bingo = {
  slashCommand: {
    name: `bingo`,
    description: `Display this week's bingo board.`,
    type: `CHAT_INPUT`,
  },
  action: async (msg, client, commandIDs) => {
    try {
      await discordAPI.sendBingoBoard(msg.channel, false, msg, commandIDs);
    } catch (error) {
      discordAPI.sendErrorMessage(msg.channel);
      console.log(error);
    }
  }
};

const lastBingo = {
  slashCommand: {
    name: `lastbingo`,
    description: `Display last week's bingo board.`,
    type: `CHAT_INPUT`,
  },
  action: async (msg, client, commandIDs) => {
    try {
      await discordAPI.sendBingoBoard(msg.channel, true, msg, commandIDs);
    } catch (error) {
      discordAPI.sendErrorMessage(msg.channel);
      console.log(error);
    }
  }
};

const bingoOptions = [];
for (let i = 0; i < 25; i++) {
  bingoOptions.push({
    name: `Field ${i + 1}`,
    value: `${i + 1}`
  });
}

const bingoVote = {
  slashCommand: {
    name: `votebingo`,
    description: `Start a vote for a bingo field.`,
    type: `CHAT_INPUT`,
    options: [
      {
        type: `STRING`,
        name: `field`,
        description: `The bingo field you want to start a vote for.`,
        required: true,
        choices: bingoOptions
      }
    ]
  },
  action: async (msg, client, commandIDs) => {
    try {
      const bingoID = msg.options.get(`field`).value;
      if (!bingoID || Number.isNaN(parseInt(bingoID))) {
        utils.sendMessage(msg.channel, `I didn't catch that - to vote on a bingo field, use ${utils.formatCommand(`votebingo`, commandIDs)}.`, msg);
      } else {
        await discordAPI.sendBingoVote(msg.channel, parseInt(bingoID), msg);
      }
    } catch (error) {
      discordAPI.sendErrorMessage(msg.channel);
      console.error(error);
    }
  }
};

const invite = {
  slashCommand: {
    name: `invite`,
    description: `Get an invite link for the TOTD Bot.`,
    type: `CHAT_INPUT`,
  },
  action: async (msg) => {
    try {
      utils.sendMessage(msg.channel, format.formatInviteMessage(), msg);
    } catch (error) {
      discordAPI.sendErrorMessage(msg.channel);
      console.log(error);
    }
  }
};

const rankings = {
  slashCommand: {
    name: `rankings`,
    description: `Display TOTD rankings based on bot ratings.`,
    type: `CHAT_INPUT`,
    options: [
      {
        type: `STRING`,
        name: `timeframe`,
        description: `The time frame you want to see rankings for.`,
        required: true,
        autocomplete: true
      }
    ]
  },
  action: async (msg) => {
    if (msg.isAutocomplete()) {
      try {
        const focusedValue = msg.options.getFocused();

        const monthsBackwards = [...luxon.Info.months(`long`)].reverse();
        // hard-coded year and month for the first TOTD entry in the DB
        const firstYear = 2021;
        const firstMonth = `July`;
        const currentYear = luxon.DateTime.now().year;
        const currentMonth = luxon.DateTime.now().monthLong;

        let options = [];

        let currentMonthReached = false;
        for (let year = currentYear; year >= firstYear; year--) {
          for (const month of monthsBackwards) {
            if (!currentMonthReached) {
              if (month === currentMonth) {
                currentMonthReached = true;
              } else {
                continue;
              }
            }

            options.push({name: `${month} ${year}`, value: `${month} ${year}`});

            if (month === `January`) {
              options.push({name: `${year} (full year)`, value: `complete ${year}`});
            }
            if (year === firstYear && month === firstMonth) {
              options.push({name: `${year} (full year)`, value: `complete ${year}`});
              options.push({name: `All-time`, value: `all-time`});
              break;
            }
          }
        }

        options = options.filter((option) => option.name.toLowerCase().includes(focusedValue.toLowerCase()));

        await msg.respond(options.slice(0, 25));
      } catch (error) {
        console.error(error);
      }
    } else {
      let timeframe = ``;
      try {
        timeframe = msg.options.get(`timeframe`).value;

        const rankings = await discordAPI.calculateRankings(timeframe);
        const rankingMessage = format.formatRankingMessage(rankings, timeframe);
        utils.sendMessage(msg.channel, rankingMessage, msg);
      } catch (error) {
        utils.sendMessage(msg.channel, error.message, msg);
        console.warn(`Error during /rankings with timeframe "${timeframe}":`, error);
      }
    }
  }
};

const help = {
  slashCommand: {
    name: `help`,
    description: `Get a list of all commands for the TOTD Bot.`,
    type: `CHAT_INPUT`,
  },
  action: async (msg, client, commandIDs) => {
    let message = `${utils.formatCommand(`today`, commandIDs)} - Display the current TOTD information.\n \
      ${utils.formatCommand(`leaderboard`, commandIDs)} - Display the current top 10 (and the time for top 100).\n \
      ${utils.formatCommand(`ratings`, commandIDs)} - Display a stored TOTD's ratings.\n \
      ${utils.formatCommand(`rankings`, commandIDs)} - Display TOTD rankings based on bot ratings.\n \
      ${utils.formatCommand(`bingo`, commandIDs)} - Display this week's bingo board for this server.\n \
      ${utils.formatCommand(`lastbingo`, commandIDs)} - Display last week's bingo board for this server.\n \
      ${utils.formatCommand(`votebingo`, commandIDs)} - Start a vote to cross off that bingo field.`;

    let adminMessage;
    if (msg.member.permissions.has(`ADMINISTRATOR`) || utils.checkMessageAuthorForTag(msg, adminTag)) {
      adminMessage = `\n${utils.formatCommand(`enable`, commandIDs)} - Enable daily TOTD posts in this channel.\n \
      ${utils.formatCommand(`disable`, commandIDs)} - Disable the daily posts again.\n \
      ${utils.formatCommand(`enablepings`, commandIDs)} - Enable pings ten minutes before COTD.\n \
      ${utils.formatCommand(`disablepings`, commandIDs)} - Disable daily pings again.`;
    }
    try {
      const formattedMessage = format.formatHelpMessage(message, adminMessage);
      formattedMessage.ephemeral = true;
      utils.sendMessage(msg.channel, formattedMessage, msg);
    } catch (error) {
      discordAPI.sendErrorMessage(msg.channel);
      console.log(error);
    }
  }
};

const refresh = {
  slashCommand: {
    name: `refreshtotd`,
    description: `Manually refresh the current TOTD data.`,
    type: `CHAT_INPUT`,
  },
  action: async (msg) => {
    if (utils.checkMessageAuthorForTag(msg, adminTag)) {
      try {
        const response = await utils.sendMessage(msg.channel, `Working on it... ${utils.getEmojiMapping(`Loading`)}`, msg);
        await discordAPI.getTOTDMessage(true);
        response.edit(`I've refreshed the current TOTD data!`);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

const refreshLeaderboard = {
  slashCommand: {
    name: `refreshleaderboard`,
    description: `Manually refresh the current leaderboard data.`,
    type: `CHAT_INPUT`,
  },
  action: async (msg) => {
    if (utils.checkMessageAuthorForTag(msg, adminTag)) {
      try {
        const response = await utils.sendMessage(msg.channel, `Working on it... ${utils.getEmojiMapping(`Loading`)}`, msg);
        await discordAPI.getTOTDLeaderboardMessage(true);
        response.edit(`I've refreshed the current leaderboard data!`);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

const refreshRatings = {
  slashCommand: {
    name: `refreshratings`,
    description: `Manually refresh the current ratings data.`,
    type: `CHAT_INPUT`,
  },
  action: async (msg) => {
    if (utils.checkMessageAuthorForTag(msg, adminTag)) {
      try {
        const response = await utils.sendMessage(msg.channel, `Working on it... ${utils.getEmojiMapping(`Loading`)}`, msg);
        const redisClient = await redisAPI.login();
        await redisAPI.clearTOTDRatings(redisClient);
        redisAPI.logout(redisClient);
        response.edit(`I've refreshed the current rating data!`);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

const refreshBingo = {
  slashCommand: {
    name: `refreshbingo`,
    description: `Manually refresh the current bingo board for a server.`,
    type: `CHAT_INPUT`,
    options: [
      {
        type: `STRING`,
        name: `serverid`,
        description: `The server ID to refresh the bingo board for.`,
        required: true
      }
    ]
  },
  action: async (msg, client, commandIDs) => {
    if (utils.checkMessageAuthorForTag(msg, adminTag)) {
      try {
        const serverID = msg.options.get(`serverid`).value;
        const response = await utils.sendMessage(msg.channel, `Working on it... ${utils.getEmojiMapping(`Loading`)}`, msg);
        await discordAPI.getBingoMessage(serverID, false, true, commandIDs);
        response.edit(`I've refreshed the current bingo board!`);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

const refreshBingoCount = {
  slashCommand: {
    name: `refreshbingocount`,
    description: `Manually refresh the current bingo vote count.`,
    type: `CHAT_INPUT`,
  },
  action: async (msg, client) => {
    if (utils.checkMessageAuthorForTag(msg, adminTag)) {
      try {
        const response = await utils.sendMessage(msg.channel, `Working on it... ${utils.getEmojiMapping(`Loading`)}`, msg);
        await discordAPI.countBingoVotes(client);
        response.edit(`I've counted and resolved the current bingo votes!`);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

const serverInfo = {
  slashCommand: {
    name: `servers`,
    description: `Get information about the servers the TOTD bot is in.`,
    type: `CHAT_INPUT`,
  },
  action: async (msg, client) => {
    if (utils.checkMessageAuthorForTag(msg, adminTag)) {
      try {
        const servers = [];
        let memberCount = 0;
        client.guilds.cache.forEach(async (guild) => {
          servers.push(guild);
          memberCount += guild.memberCount;
        });
        utils.sendMessage(msg.channel, `I'm currently in ${servers.length} servers and counting - reaching an audience of ${memberCount}!`, msg);

        // fetch and log detailed infos asynchronously
        servers.forEach(async (server) => {
          const owner = await client.users.fetch(server.ownerId); // don't use fetchOwner since we need the owner user, not the guild member
          console.log(`Server: ${server.name} (${server.memberCount}) - Owner: ${owner.tag} - ID: ${server.id}`);
        });
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

const distributeTOTDMessages = {
  slashCommand: {
    name: `distribute`,
    description: `Manually broadcast the current TOTD message to all subscribed channels.`,
    type: `CHAT_INPUT`,
    options: [
      {
        type: `STRING`,
        name: `confirm`,
        description: `Send "yes" to confirm you really want to do this.`,
        required: true
      }
    ]
  },
  action: async (msg, client) => {
    if (utils.checkMessageAuthorForTag(msg, adminTag)) {
      try {
        const confirmation = msg.options.get(`confirm`).value;
        if (confirmation !== `yes`) {
          utils.sendMessage(msg.channel, `Ignoring broadcast command because it was missing the required confirmation.`, msg);
        } else {
          discordAPI.distributeTOTDMessages(client);
        }
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

const kem = {
  slashCommand: {
    name: `kem`,
    description: `Say the line, Bart!`,
    type: `CHAT_INPUT`,
  },
  action: async (msg) => {
    try {
      utils.sendMessage(msg.channel, `Fix it, Kem!`, msg);
    } catch (error) {
      discordAPI.sendErrorMessage(msg.channel);
      console.log(error);
    }
  }
};

const debug = {
  slashCommand: {
    name: `debug`,
    description: `Placeholder command for testing.`,
    type: `CHAT_INPUT`,
  },
  action: async (msg) => {
    if (utils.checkMessageAuthorForTag(msg, adminTag)) {
      try {
        utils.sendMessage(msg.channel, `Debug me!`, msg);
      } catch (error) {
        discordAPI.sendErrorMessage(msg.channel);
        console.error(error);
      }
    }
  }
};

module.exports = {
  globalCommands: [
    help,
    invite,
    today,
    leaderboard,
    ratings,
    rankings,
    enable,
    disable,
    setRole,
    removeRole,
    bingo,
    lastBingo,
    bingoVote,
    kem
  ],
  adminCommands: [
    refresh,
    refreshLeaderboard,
    refreshRatings,
    refreshBingo,
    refreshBingoCount,
    debug,
    serverInfo,
    distributeTOTDMessages
  ]
};
