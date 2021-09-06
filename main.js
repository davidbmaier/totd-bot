const Discord = require(`discord.js`);
const client = new Discord.Client({ partials: [`MESSAGE`, `CHANNEL`, `REACTION`] });
const cron = require(`cron`).CronJob;
require(`dotenv`).config();

const discordAPI = require(`./src/discordAPI`);
const redisAPI = require(`./src/redisApi`);
const format = require(`./src/format`);
const commands = require(`./src/commands`);
const utils = require(`./src/utils`);
const constants = require(`./src/constants`);

const discordToken = process.env.DISCORD_TOKEN;
const deployMode = process.env.DEPLOY_MODE;

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

// refresh bingo every week on Monday at 19:00:30 (just after the TOTD because that counts yesterday's bingo votes)
new cron(
  `30 00 19 * * 1`,
  async () => {
    await discordAPI.getBingoMessage(true);
  },
  null,
  true,
  `Europe/Paris`
);

client.on(`ready`, async () => {
  console.log(`Ready as ${client.user.tag}!`);

  // in production, refresh TOTD to make sure there is a thumbnail in the images for cached messages
  if (deployMode === `prod`) {
    await discordAPI.getTOTDMessage(true);
  }

  // check if monthly and all-time ratings exist, otherwise initialize them
  const redisClient = await redisAPI.login();
  try {
    const monthly = await redisAPI.getRatingRankings(redisClient, constants.ratingRankingType.monthly);
    const lastMonthly = await redisAPI.getRatingRankings(redisClient, constants.ratingRankingType.lastMonthly);
    const allTime = await redisAPI.getRatingRankings(redisClient, constants.ratingRankingType.allTime);
    if (!monthly) {
      console.log(`Initializing monthly rating rankings...`);
      await redisAPI.saveRatingRankings(redisClient, constants.ratingRankingType.monthly, {top: [], bottom: []});
    }
    if (!lastMonthly) {
      console.log(`Initializing last monthly rating rankings...`);
      await redisAPI.saveRatingRankings(redisClient, constants.ratingRankingType.lastMonthly, {top: [], bottom: []});
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
});

client.on(`message`, async (msg) => {
  if (msg.guild && msg.content.startsWith(utils.addDevPrefix(`!totd`))) {
    console.log(`Received message: ${msg.content} (#${msg.channel.name} in ${msg.guild.name})`);

    const matchedCommand = commands.find((command) => {
      let aliases = [];
      if (Array.isArray(command.command)) {
        aliases = command.command;
      } else {
        aliases = [command.command];
      }

      const matchedAlias = aliases.find((alias) => msg.content.toLowerCase().startsWith(alias.toLowerCase()));
      return !!matchedAlias;
    });

    if (matchedCommand) {
      await matchedCommand.action(msg, client);
    } else {
      try {
        await msg.channel.send(
          `I don't know what to do, you might want to check \`${utils.addDevPrefix(`!totd help`)}\` to see what I can understand.`
        );
      } catch (error) {
        if (error.message === `Missing Permissions`) {
          console.error(`Unable to send error message to channel #${msg.channel.name} in ${msg.guild.name}, no permissions`);
        } else {
          console.error(`Unexpected error while sending error message to channel #${msg.channel.name} in ${msg.guild.name}`);
          console.error(error.message);
        }
      }
    }
  } else if (msg.mentions.has(client.user.id, {ignoreEveryone: true})) {
    const redisClient = await redisAPI.login();
    const adminConfig = await redisAPI.getAdminServer(redisClient);
    redisAPI.logout(redisClient);

    if (adminConfig?.channelID) {
      console.log(`Proxying mention to admin server...`);
      const adminChannel = await client.channels.fetch(adminConfig.channelID);
      const proxyMessage = format.formatProxyMessage(msg);
      adminChannel.send(proxyMessage);
    }
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
  console.log(`Joined new server: ${guild.name}`);
});

client.on(`guildDelete`, (guild) => {
  console.log(`Left server: ${guild.name}`);
});

client.login(discordToken);
