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

const getBingoMessage = async (forceRefresh, lastWeek) => {
  const redisClient = await redisAPI.login();
  let board = await redisAPI.getBingoBoard(redisClient, lastWeek);
  
  if (lastWeek) {
    if (board) {
      console.log(`Using last week's board`);
      redisAPI.logout(redisClient);
      return await format.formatBingoBoard(board, lastWeek);
    } else {
      console.log(`Couldn't find last week's board`);
      return `Hmm, I don't remember last week's board. Sorry about that!`;
    }
  } else {
    if (!board || forceRefresh) {
      if (board) {
        console.log(`Archiving old bingo board...`);
        await redisAPI.saveBingoBoard(redisClient, board, true);
      }

      console.log(`Regenerating bingo board...`);
      const bingoFields = [...constants.bingoFields];
      const pickedFields = [];
      while (pickedFields.length < 24) {
        // TODO: add weights so there's only max 3 map themes/3 author fields
        const randomPick = Math.floor(Math.random() * bingoFields.length);
        const pickedField = bingoFields.splice(randomPick, 1)[0];
        pickedFields.push({
          text: pickedField,
          checked: false,
          voteActive: false
        });
      }

      board = pickedFields;

      await redisAPI.saveBingoBoard(redisClient, board);
      console.log(`Refreshed bingo board in Redis`);
    } else {
      console.log(`Using cached bingo board...`);
    }

    redisAPI.logout(redisClient);
    return await format.formatBingoBoard(board);
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
  const ratingString = yesterday ? `yesterday's verdict` : `current rating`;
  console.log(`Sending ${ratingString} to #${channel.name} in ${channel.guild.name}`);
  const message = await getRatingMessage(yesterday);
  await channel.send(message);
};

const sendBingoBoard = async (channel, lastWeek) => {
  const bingoString = lastWeek ? `last week's` : `current`;
  console.log(`Sending ${bingoString} bingo board to #${channel.name} in ${channel.guild.name}`);
  const message = await getBingoMessage(false, lastWeek);
  await channel.send(message);
};

const sendBingoVote = async (channel, bingoID) => {
  const redisClient = await redisAPI.login();
  let board = await redisAPI.getBingoBoard(redisClient);
  
  // add free space to the center
  board.splice(12, 0, {text: `Free space`, checked: false});
  
  if (bingoID < 1 || bingoID > 25) {
    return await channel.send(`Hmm, that's not on the board. I only understand numbers from 1 to 25 I'm afraid.`);
  } else if (bingoID === 13) {
    return await channel.send(`You want to vote on the free space? Are you okay?`);
  }

  const field = board[bingoID - 1];
  if (field.checked) {
    return await channel.send(`Looks like that field is already checked off for this week.`);
  } else if (field.voteActive) {
    return await channel.send(`There's already a vote going on for that field, check again tomorrow.`);
  }

  const textWithoutBreaks = field.text.replace(/\n/g, ` `);
  const voteMessage = await channel.send(
    `Bingo vote started: **${textWithoutBreaks}**\n` +
    `Does that sound like today's track?\n` +
    `Vote using the reactions below - I'll close the vote when the next TOTD comes out.`
  );

  const voteYes = utils.getEmojiMapping(`VoteYes`);
  const voteNo = utils.getEmojiMapping(`VoteNo`);
  voteMessage.react(voteYes);
  voteMessage.react(voteNo);

  board[bingoID - 1].voteActive = true;
  board[bingoID - 1].voteMessageID = voteMessage.id;
  board[bingoID - 1].voteChannelID = voteMessage.channel.id;
  // remove free space so it doesn't get saved
  board.splice(12, 1);

  // save vote info to redis
  await redisAPI.saveBingoBoard(redisClient, board);
  return redisAPI.logout(redisClient);
};

const countBingoVotes = async (client) => {
  console.log(`Counting outstanding bingo votes...`);
  const redisClient = await redisAPI.login();
  let board = await redisAPI.getBingoBoard(redisClient);

  const updatedFields = [];

  for (let i = 0; i < board.length; i++) {
    const field = board[i];
    if (!field.checked && field.voteActive && field.voteMessageID && field.voteChannelID) {
      // vote found, resolving it
      const voteChannel = await client.channels.fetch(field.voteChannelID);
      const voteMessage = await voteChannel.messages.fetch(field.voteMessageID);

      const voteYes = utils.getEmojiMapping(`VoteYes`);
      const voteNo = utils.getEmojiMapping(`VoteNo`);

      let countYes = 0;
      let countNo = 0;
      
      voteMessage.reactions.cache.forEach((reaction, reactionID) => {
        // use count - 1 since the bot adds one initially
        if (voteYes.includes(reactionID)) {
          countYes = reaction.count - 1;
        } else if (voteNo.includes(reactionID)) {
          countNo = reaction.count - 1;
        }
        // if Yes and No both don't match, ignore the reaction
      });

      if (countYes > countNo) {
        field.checked = true;
        delete field.voteActive;
        delete field.voteMessageID;
        delete field.voteChannelID;
        updatedFields.push(field.text);
      } else {
        field.voteActive = false;
        delete field.voteMessageID;
        delete field.voteChannelID;
      }
    }
  }

  if (updatedFields.length > 0) {
    console.log(`Vote check finished, newly checked fields:`, updatedFields);
  } else {
    console.log(`Vote check finished, no new bingo field checked`);
  }

  await redisAPI.saveBingoBoard(redisClient, board);
  return redisAPI.logout(redisClient);
};

const archiveRatings = async () => {
  console.log(`Archiving existing ratings and clearing current ones...`);
  const redisClient = await redisAPI.login();
  const ratings = await redisAPI.getTOTDRatings(redisClient);

  console.log(`Old ratings:`, ratings);

  if (ratings) {
    await redisAPI.saveLastTOTDVerdict(redisClient, ratings);
  }
  await redisAPI.clearTOTDRatings(redisClient);

  return await redisAPI.logout(redisClient);
};

const distributeTOTDMessages = async (client) => {
  console.log(`Broadcasting TOTD message to subscribed channels`);
  const message = await getTOTDMessage(true);

  await archiveRatings();
  countBingoVotes(client);

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

const sendCOTDPings = async (client, region) => {
  console.log(`Broadcasting COTD ping to subscribed servers with role config for ${region || `default`} region`);

  const redisClient = await redisAPI.login();
  const configs = await redisAPI.getAllConfigs(redisClient);
  redisAPI.logout(redisClient);

  const roleProp = region && region !== constants.cupRegions.europe ? `roleName${region}` : `roleName`;

  configs.forEach(async (config) => {
    if (config[roleProp]) {
      try {
        const channel = await client.channels.fetch(config.channelID);
        console.log(`Pinging ${config[roleProp]} in #${channel.name} (${channel.guild.name})`);
        channel.send(`${config[roleProp]} The Cup of the Day is about to begin! ${utils.getEmojiMapping(`COTDPing`)} Ten minutes to go!`);
      } catch (error) {
        if (error.message === `Missing Access`) {
          console.log(`Can't access server, bot was probably kicked.`);
        } else {
          console.error(error);
        }
      }
    }
  });
};

const updateTOTDReactionCount = async (reaction, add) => {
  // check that the message really is the current TOTD
  const redisClient = await redisAPI.login();
  const totdMessage = await redisAPI.getCurrentTOTD(redisClient);

  // it's possible there is no message in the redis cache, but that's a rare edge case (in which reactions won't be recorded)
  const currentTrackName = totdMessage?.embed?.fields.find((field) => field.name === `Name`)?.value.trim();
  const reactionTrackName = reaction.message?.embeds[0]?.fields.find((field) => field.name === `Name`)?.value.trim();
  if (currentTrackName === reactionTrackName) {
    const ratingEmojis = constants.ratingEmojis;
    for (let i = 0; i < ratingEmojis.length; i++) {
      const ratingIdentifier = utils.getEmojiMapping(ratingEmojis[i]);

      if (ratingIdentifier.includes(reaction.emoji.identifier)) {
        console.log(`Detected rating reaction in #${reaction.message.channel.name} (${reaction.message.channel.guild.name}), updating current ratings`);
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
  getBingoMessage,
  sendErrorMessage,
  sendTOTDLeaderboard,
  sendTOTDRatings,
  sendBingoBoard,
  sendBingoVote,
  countBingoVotes,
  distributeTOTDMessages,
  sendCOTDPings,
  updateTOTDReactionCount
};
