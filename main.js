const Discord = require(`discord.js`);
const client = new Discord.Client({
  partials: [`MESSAGE`, `CHANNEL`, `REACTION`],
  intents: [
    Discord.Intents.FLAGS.GUILDS, // for join and leave events
    Discord.Intents.FLAGS.GUILD_MESSAGES, // for receiving commands through messages
    Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS // for receiving rating reactions
  ],
  retryLimit: 3 // prevent random 500s from failing requests immediately
});
const cron = require(`cron`).CronJob;
require(`dotenv`).config();

const discordAPI = require(`./src/discordAPI`);
const tmAPI = require(`./src/tmApi`);
const redisAPI = require(`./src/redisApi`);
const format = require(`./src/format`);
const commands = require(`./src/commands`);
const utils = require(`./src/utils`);
const constants = require(`./src/constants`);

const discordToken = process.env.DISCORD_TOKEN;
const deployMode = process.env.DEPLOY_MODE;
const adminServerID = process.env.ADMIN_SERVER_ID;
const adminChannelID = process.env.ADMIN_CHANNEL_ID;

const commandIDs = {};

// COTD pings for 7pm (Europe)
new cron(
  `00 50 18 * * *`,
  async () => {
    await discordAPI.sendCOTDPings(client, constants.cupRegions.europe);
  },
  null,
  true,
  `Europe/Paris`
);

// COTD pings for 3am (America)
new cron(
  `00 50 02 * * *`,
  async () => {
    await discordAPI.sendCOTDPings(client, constants.cupRegions.america);
  },
  null,
  true,
  `Europe/Paris`
);

// COTD pings for 11am (Asia)
new cron(
  `00 50 10 * * *`,
  async () => {
    await discordAPI.sendCOTDPings(client, constants.cupRegions.asia);
  },
  null,
  true,
  `Europe/Paris`
);

// display the current totd every day at 19:00:10
new cron(
  `10 00 19 * * *`,
  async () => {
    await discordAPI.distributeTOTDMessages(client);
  },
  null,
  true,
  `Europe/Paris`
);

// refresh bingo every week on Monday at 19:00:20 (just after the TOTD because that counts yesterday's bingo votes)
new cron(
  `20 00 19 * * 1`,
  async () => {
    await discordAPI.archiveBingoBoards();
  },
  null,
  true,
  `Europe/Paris`
);

client.on(`ready`, async () => {
  console.log(`Ready as ${client.user.tag}!`);

  await tmAPI.login();
  await tmAPI.loginOAuth();

  // in production, refresh TOTD to make sure there is a thumbnail in the images for cached messages
  if (deployMode === `prod`) {
    await discordAPI.getTOTDMessage(true);
  }

  // check if monthly and all-time ratings exist, otherwise initialize them
  const redisClient = await redisAPI.login();
  try {
    const monthly = await redisAPI.getRatingRankings(redisClient, constants.ratingRankingType.monthly);
    const lastMonthly = await redisAPI.getRatingRankings(redisClient, constants.ratingRankingType.lastMonthly);
    const yearly = await redisAPI.getRatingRankings(redisClient, constants.ratingRankingType.yearly);
    const lastYearly = await redisAPI.getRatingRankings(redisClient, constants.ratingRankingType.lastYearly);
    const allTime = await redisAPI.getRatingRankings(redisClient, constants.ratingRankingType.allTime);
    if (!monthly) {
      console.log(`Initializing monthly rating rankings...`);
      await redisAPI.saveRatingRankings(redisClient, constants.ratingRankingType.monthly, {top: [], bottom: []});
    }
    if (!lastMonthly) {
      console.log(`Initializing last monthly rating rankings...`);
      await redisAPI.saveRatingRankings(redisClient, constants.ratingRankingType.lastMonthly, {top: [], bottom: []});
    }
    if (!yearly) {
      console.log(`Initializing yearly rating rankings...`);
      await redisAPI.saveRatingRankings(redisClient, constants.ratingRankingType.yearly, {top: [], bottom: []});
    }
    if (!lastYearly) {
      console.log(`Initializing last yearly rating rankings...`);
      await redisAPI.saveRatingRankings(redisClient, constants.ratingRankingType.lastYearly, {top: [], bottom: []});
    }
    if (!allTime) {
      console.log(`Initializing all-time rating rankings...`);
      await redisAPI.saveRatingRankings(redisClient, constants.ratingRankingType.allTime, {top: [], bottom: []});
    }
  } catch (error) {
    console.log(`Unexpected error during monthly/all-time initialization:`, error);
  } finally {
    redisAPI.logout(redisClient);
  }

  // register all the commands (this might take a minute due to Discord rate limits)
  const globalCommandConfigs = commands.globalCommands.map((commandConfig) => commandConfig.slashCommand);
  const adminCommandConfigs = commands.adminCommands.map((commandConfig) => commandConfig.slashCommand);

  const adminGuild = await client.guilds.fetch(adminServerID);
  let globalCommandManager;
  if (deployMode !== `prod`) {
    // use admin guild for global commands in dev mode
    globalCommandManager = adminGuild.commands;
  } else {
    globalCommandManager = client.application.commands;
  }
  const adminCommandManager = adminGuild.commands;

  for (const commandConfig of globalCommandConfigs) {
    if (commandConfig) {
      const commandRes = await globalCommandManager.create(commandConfig);
      commandIDs[commandConfig.name] = commandRes.id;
      console.log(`Registered global command: ${commandConfig.name}`);
    }
  }
  for (const commandConfig of adminCommandConfigs) {
    if (commandConfig) {
      await adminCommandManager.create(commandConfig);
      console.log(`Registered admin command: ${commandConfig.name}`);
    }
  }

  const existingCommands = await globalCommandManager.fetch();
  const joinedCommands = commands.globalCommands.concat(commands.adminCommands);

  existingCommands.forEach((command) => {
    const foundCommand = joinedCommands.find((c) => c.slashCommand.name === command.name);
    if (!foundCommand) {
      console.log(`Removing command ${command.name}`);
      globalCommandManager.delete(command.id);
    }
  });
});

client.on(`interactionCreate`, async (interaction) => {
  if (interaction.isCommand()) {
    if (!interaction.guildId) {
      // bot doesn't support DMs for now, reply with an explanation
      return await interaction.reply(`Sorry, I don't support DMs. Please use my commands in a server that we share.`);
    }

    console.log(`Received command: ${interaction.commandName} (#${interaction.channel.name} in ${interaction.guild?.name})`);
    const joinedCommands = commands.globalCommands.concat(commands.adminCommands);
    const matchedCommand = joinedCommands.find((commandConfig) => commandConfig?.slashCommand?.name === interaction.commandName);
    if (matchedCommand) {
      try {
        await matchedCommand.action(interaction, client, commandIDs);
      } catch (e) {
        console.error(e);
      }
    } else {
      console.error(`No matching command found`);
    }
  } else if (interaction.isAutocomplete()) {
    console.log(`Received autocomplete for ${interaction.commandName} (#${interaction.channel.name} in ${interaction.guild.name} - @${interaction.user.username})): ${interaction.options.getFocused()}`);
    const joinedCommands = commands.globalCommands.concat(commands.adminCommands);
    const matchedCommand = joinedCommands.find((commandConfig) => commandConfig.slashCommand.name === interaction.commandName);
    if (matchedCommand) {
      try {
        await matchedCommand.action(interaction, client);
      } catch (e) {
        console.log(e);
      }
    } else {
      console.log(`No matching command found`);
    }
  }
});

client.on(`messageCreate`, async (msg) => {
  if (msg.mentions.has(client.user.id, {ignoreEveryone: true})) {
    const redisClient = await redisAPI.login();
    redisAPI.logout(redisClient);

    console.log(`Proxying mention to admin server...`);
    const adminChannel = await client.channels.fetch(adminChannelID);
    const proxyMessage = format.formatProxyMessage(msg);
    utils.sendMessage(adminChannel, proxyMessage);
  }
});

const handleReaction = async (reaction, user, add) => {
  if (reaction.partial) {
		// if reaction is partial (not cached), try to fetch it fully
		try {
			await reaction.fetch();
		} catch (error) {
			console.error(`Something went wrong when fetching the full reaction: `, error);
			return;
		}
	}

  if (
    reaction.message.author && (reaction.message.author.id === client.user.id) // check the message was sent by the bot
    && user.id !== client.user.id // check the reaction was not sent by the bot
  ) {
    discordAPI.updateTOTDReactionCount(reaction, add, user);
  }
};

client.on(`messageReactionAdd`, (reaction, user) => {
  handleReaction(reaction, user, true);
});

client.on(`messageReactionRemove`, async (reaction, user) => {
  handleReaction(reaction, user, false);
});

client.on(`guildCreate`, (guild) => {
  console.log(`Joined new server: ${guild.name} (${guild.id})`);
});

client.on(`guildDelete`, (guild) => {
  console.log(`Left server: ${guild.name} (${guild.id})`);
});

/* client.on(`rateLimit`, (rateLimit) => {
  console.warn(`Rate limit reached: ${rateLimit.limit} on ${rateLimit.method} ${rateLimit.path} (global: ${rateLimit.global}) - wait for ${rateLimit.timeout}`);
}); */

client.login(discordToken);
