const tmAPI = require(`./tmApi`);
const format = require(`./format`);
const redisAPI = require(`./redisApi`);
const utils = require(`./utils`);

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

  // save fresh message to redis
  const redisClient = await redisAPI.login();
  await redisAPI.saveCurrentTOTD(redisClient, formattedMessage);
  redisAPI.logout(redisClient);

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
    const formattedMessage = format.formatLeaderboardMessage(totd, top, utils.convertToUNIXSeconds(new Date()));

    // save fresh message to redis
    const redisClient = await redisAPI.login();
    await redisAPI.saveCurrentLeaderboard(redisClient, formattedMessage);
    redisAPI.logout(redisClient);

    return formattedMessage;
  } else {
    console.log(`Using cached leaderboard...`);
    return cachedleaderBoardMessage;  
  }
};

const sendTOTDMessage = async (client, channel, message) => {
  console.log(`Sending current TOTD to #${channel.name} in ${channel.guild.name}`);

  const discordMessage = await channel.send(message);
  // add rating emojis
  const emojis = [
    client.emojis.resolve(`807983766239838208`),
    client.emojis.resolve(`807983738603962368`),
    client.emojis.resolve(`807983713698316308`),
    client.emojis.resolve(`807983669330706482`),
    client.emojis.resolve(`807983625001107497`),
    client.emojis.resolve(`807983052046598165`)
  ];
  emojis.forEach(async (emoji) => {
    await discordMessage.react(emoji);
  });
};

const sendTOTDLeaderboard = async (client, channel) => {
  console.log(`Sending current leaderboard to #${channel.name} in ${channel.guild.name}`);

  const discordMessage = await channel.send(`Fetching current leaderboard, give me a second...`);

  const leaderboardMessage = await getTOTDLeaderboardMessage();
  const minutesAgo = utils.getMinutesAgo(new Date(leaderboardMessage.date * 1000));
  if (minutesAgo === 0) {
    leaderboardMessage.embed.description = `Last refreshed: Just now`;
  } else {
    leaderboardMessage.embed.description = `Last refreshed: ${minutesAgo} minutes ago`;
  }
  
  discordMessage.edit(leaderboardMessage);
};

const distributeTOTDMessages = async (client) => {
  console.log(`Broadcasting TOTD message to subscribed channels`);
  const message = await getTOTDMessage(true);

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

const sendErrorMessage = (channel) => {
  channel.send(`Oops, something went wrong here - please talk to my dev and let him know that didn't work.`);
};

module.exports = {
  sendTOTDMessage,
  getTOTDMessage,
  getTOTDLeaderboardMessage,
  sendErrorMessage,
  sendTOTDLeaderboard,
  distributeTOTDMessages
};
