const tmAPI = require(`./tmApi`);
const format = require(`./format`);
const redisAPI = require(`./redisApi`);
const utils = require(`./utils`);
const constants = require(`./constants`);

const getTOTDMessage = async (forceRefresh) => {
  if (!forceRefresh) {
    console.log(`Using cached TOTD...`);
    const redisClient = await redisAPI.login();
    const totdMessage = await redisAPI.getCurrentTOTD(redisClient);
    redisAPI.logout(redisClient);

    if (totdMessage) {
      return totdMessage;
    }
    // if there is no message yet, refresh
    console.log(`No cached TOTD exists yet, falling back to refresh`);
  }

  console.log(`Refreshing TOTD from API...`);
  const credentials = await tmAPI.loginToTM();
  const totd = await tmAPI.getCurrentTOTD(credentials);
  const formattedMessage = format.formatTOTDMessage(totd);

  // also refresh the leaderboard
  getTOTDLeaderboardMessage(true);

  // save fresh message to redis
  const redisClient = await redisAPI.login();
  await redisAPI.saveCurrentTOTD(redisClient, formattedMessage);
  redisAPI.logout(redisClient);

  console.log(`Refreshed TOTD in Redis`);
  return formattedMessage;
};

const getTOTDLeaderboardMessage = async (forceRefresh) => {
  const redisClient = await redisAPI.login();
  const cachedleaderBoardMessage = await redisAPI.getCurrentLeaderboard(redisClient);
  redisAPI.logout(redisClient);

  if (
    forceRefresh
    || !cachedleaderBoardMessage
    || cachedleaderBoardMessage.date < utils.convertToUNIXSeconds(new Date()) - 600
  ) {
    // if cached message does not exist or is older than ten minutes, refresh
    console.log(`Refreshing leaderboard from API...`);
    const credentials = await tmAPI.loginToTM();
    const totd = await tmAPI.getCurrentTOTD(credentials);
    const top = await tmAPI.getTOTDLeaderboard(credentials, totd.seasonUid, totd.mapUid);
    // if top doesn't exist yet, fall back
    if (!top) {
      const fallbackMessage = `Hmm, either there's not enough records yet, or the leaderboard is being updated too fast - please check again in a couple minutes.`;

      // clear leaderboard message in redis
      const redisClient = await redisAPI.login();
      await redisAPI.clearCurrentLeaderboard(redisClient);
      redisAPI.logout(redisClient);

      return fallbackMessage;
    }

    const formattedMessage = format.formatLeaderboardMessage(totd, top, utils.convertToUNIXSeconds(new Date()));

    // save fresh message to redis
    const redisClient = await redisAPI.login();
    await redisAPI.saveCurrentLeaderboard(redisClient, formattedMessage);
    redisAPI.logout(redisClient);

    console.log(`Refreshed leaderboard in Redis`);
    return formattedMessage;
  } else {
    console.log(`Using cached leaderboard...`);
    return cachedleaderBoardMessage;  
  }
};

const getRatingMessage = async (yesterday) => {
  const redisClient = await redisAPI.login();
  let ratings;
  if (yesterday) {
    ratings = await redisAPI.getLastTOTDVerdict(redisClient);
  } else {
    ratings = await redisAPI.getTOTDRatings(redisClient);
  }
  redisAPI.logout(redisClient);

  if (ratings) {
    return format.formatRatingsMessage(ratings, yesterday);
  } else {
    return `Hmm, I don't seem to remember yesterday's track. Sorry about that!`;
  }
};

const sendTOTDMessage = async (client, channel, message) => {
  console.log(`Sending current TOTD to #${channel.name} in ${channel.guild.name}`);
  const discordMessage = await channel.send(message);
  // add rating emojis
  const emojis = [];
  for (let i = 0; i < constants.ratingEmojis.length; i++) {
    emojis.push(utils.getEmojiMapping(constants.ratingEmojis[i]));
  }
  emojis.forEach(async (emoji) => {
    await discordMessage.react(emoji);
  });
};

const sendTOTDLeaderboard = async (client, channel) => {
  const discordMessage = await channel.send(`Fetching current leaderboard, give me a second... ${utils.getEmojiMapping(`Loading`)}`);

  const leaderboardMessage = await getTOTDLeaderboardMessage();
  // if no records exist yet, it'll just be a string
  if (leaderboardMessage.date) {
    const minutesAgo = utils.getMinutesAgo(new Date(leaderboardMessage.date * 1000));
    if (minutesAgo < 1) {
      leaderboardMessage.embed.description = `Last refreshed: Just now`;
    } else {
      leaderboardMessage.embed.description = `Last refreshed: ${minutesAgo} minutes ago`;
    }
  }
  
  console.log(`Sending current leaderboard to #${channel.name} in ${channel.guild.name}`);
  discordMessage.edit(leaderboardMessage);
};

const sendTOTDRatings = async (client, channel, yesterday) => {
  console.log(`Sending current ratings to #${channel.name} in ${channel.guild.name}`);
  const message = await getRatingMessage(yesterday);
  await channel.send(message);
};

const archiveRatings = async () => {
  console.log(`Archiving existing ratings and clearing current ones`);
  const redisClient = await redisAPI.login();
  const ratings = await redisAPI.getTOTDRatings(redisClient);

  if (ratings) {
    await redisAPI.saveLastTOTDVerdict(redisClient, ratings);
  }
  await redisAPI.clearTOTDRatings(redisClient);

  redisAPI.logout(redisClient);
};

const distributeTOTDMessages = async (client) => {
  console.log(`Broadcasting TOTD message to subscribed channels`);
  const message = await getTOTDMessage(true);

  archiveRatings();

  const redisClient = await redisAPI.login();
  const configs = await redisAPI.getAllConfigs(redisClient);
  redisAPI.logout(redisClient);

  configs.forEach(async (config) => {
    try {
      const channel = await client.channels.fetch(config.channelID);
      sendTOTDMessage(client, channel, message);
    } catch (error) {
      if (error.message === `Missing Access`) {
        console.log(`Can't access server, bot was probably kicked.`);
      } else {
        console.error(error);
      }
    }
  });
};

const updateTOTDReactionCount = async (reaction, add) => {
  // check that the message really is the current TOTD
  const redisClient = await redisAPI.login();
  const totdMessage = await redisAPI.getCurrentTOTD(redisClient);

  // it's possible there is no message in the redis cache, but that's a rare edge case (in which reactions won't be recorded)
  if (totdMessage?.embed?.title === reaction.message?.embeds[0]?.title) {
    const ratingEmojis = constants.ratingEmojis;
    for (let i = 0; i < ratingEmojis.length; i++) {
      const ratingIdentifier = utils.getEmojiMapping(ratingEmojis[i]);

      if (ratingIdentifier.includes(reaction.emoji.identifier)) {
        await redisAPI.updateTOTDRatings(redisClient, ratingEmojis[i], add);
        break;
      }
    }
    redisAPI.logout(redisClient);
  } else {
    // not a TOTD post, close the redis connection
    redisAPI.logout(redisClient);
  }
};

const sendErrorMessage = (channel) => {
  channel.send(`Oops, something went wrong here - please talk to <@141627532335251456> and let him know that didn't work.`);
};

module.exports = {
  sendTOTDMessage,
  getTOTDMessage,
  getTOTDLeaderboardMessage,
  sendErrorMessage,
  sendTOTDLeaderboard,
  sendTOTDRatings,
  distributeTOTDMessages,
  updateTOTDReactionCount
};
