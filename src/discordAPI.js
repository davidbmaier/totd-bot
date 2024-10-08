const tmAPI = require(`./tmApi`);
const format = require(`./format`);
const redisAPI = require(`./redisApi`);
const utils = require(`./utils`);
const constants = require(`./constants`);
const rating = require(`./rating`);

const luxon = require(`luxon`);

const adminChannelID = process.env.ADMIN_CHANNEL_ID;

const errorMessage = `Oops, something went wrong here - please talk to <@141627532335251456> and let him know that didn't work.`;

const getTOTDMessage = async (forceRefresh) => {
  if (!forceRefresh) {
    console.log(`Using cached TOTD...`);
    const redisClient = await redisAPI.login();
    const totd = await redisAPI.getCurrentTOTD(redisClient);
    redisAPI.logout(redisClient);

    if (totd) {
      return format.formatTOTDMessage(totd);
    }
    // if there is no message yet, refresh
    console.log(`No cached TOTD exists yet, falling back to refresh`);
  }

  console.log(`Refreshing TOTD from API...`);
  const totd = await tmAPI.getCurrentTOTD();
  const formattedMessage = format.formatTOTDMessage(totd);

  // save fresh TOTD to redis
  const redisClient = await redisAPI.login();
  const oldTOTD = await redisAPI.getCurrentTOTD(redisClient);
  if (oldTOTD && oldTOTD.mapUid !== totd.mapUid) {
    // oldTOTD was a different map, so save that as yesterday's TOTD in Redis
    // note it could have been an earlier one if the bot was done for more than a day
    console.log(`Currently stored TOTD has different mapUid, storing that as yesterday's TOTD`);
    await redisAPI.savePreviousTOTD(redisClient, oldTOTD);
  }
  await redisAPI.saveCurrentTOTD(redisClient, totd);
  redisAPI.logout(redisClient);

  console.log(`Refreshed TOTD in Redis`);

  // also refresh the leaderboard
  getTOTDLeaderboardMessage(true);

  return formattedMessage;
};

const getTOTDLeaderboardMessage = async (forceRefresh) => {
  const redisClient = await redisAPI.login();
  const cachedleaderBoardMessage = await redisAPI.getCurrentLeaderboard(redisClient);
  let totd = await redisAPI.getCurrentTOTD(redisClient);
  if (!totd) {
    await getTOTDMessage();
    totd = await redisAPI.getCurrentTOTD(redisClient);
  }
  redisAPI.logout(redisClient);

  if (
    forceRefresh
    || !cachedleaderBoardMessage
    || !cachedleaderBoardMessage.date
    || cachedleaderBoardMessage.date < utils.convertToUNIXSeconds(new Date()) - 600
  ) {
    // if cached message does not exist or is older than ten minutes, refresh
    console.log(`Refreshing leaderboard from API...`);
    const top = await tmAPI.getTOTDLeaderboard(totd.seasonUid, totd.mapUid);
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

const getRatingMessage = async (mapInfo) => {
  try {
    if (mapInfo) {
      return format.formatRatingsMessage(mapInfo);
    } else {
      return `Hmm, I don't seem to remember that track. Sorry about that!`;
    }
  } catch (err) {
    console.log(`Error while getting rating message:`, err);
    return errorMessage;
  }
};

const generateNewBingoBoard = async (serverID, redisClient) => {
  console.log(`Regenerating bingo board for server ${serverID}...`);

  const bingoFields = [...constants.bingoFields];
  const pickedFields = [];
  while (pickedFields.length < 24) {
    const randomPick = Math.floor(Math.random() * bingoFields.length);
    const pickedField = bingoFields.splice(randomPick, 1)[0];
    pickedFields.push({
      text: pickedField,
      checked: false,
      voteActive: false
    });
  }

  const board = pickedFields;
  await redisAPI.saveBingoBoard(redisClient, board, serverID);
  console.log(`Refreshed bingo board in Redis`);
  return board;
};

const archiveBingoBoards = async () => {
  console.log(`Archiving old bingo boards...`);
  const redisClient = await redisAPI.login();
  const allBoards = await redisAPI.getAllBingoBoards(redisClient);
  await redisAPI.archiveBingoBoards(redisClient, allBoards);
  await redisAPI.resetBingoBoards(redisClient);
  redisAPI.logout(redisClient);
};

const getBingoMessage = async (serverID, lastWeek, forceRefresh, commandIDs) => {
  const redisClient = await redisAPI.login();
  let board = await redisAPI.getBingoBoard(redisClient, serverID, lastWeek);

  if (lastWeek) {
    if (board) {
      console.log(`Using last week's board`);
      redisAPI.logout(redisClient);
      return await format.formatBingoBoard(board, lastWeek, commandIDs);
    } else {
      console.log(`Couldn't find last week's board`);
      return `Hmm, I don't remember last week's board. Sorry about that!`;
    }
  } else {
    if (!board || forceRefresh) {
      board = await generateNewBingoBoard(serverID, redisClient);
    } else {
      console.log(`Using cached bingo board...`);
    }

    redisAPI.logout(redisClient);
    return await format.formatBingoBoard(board, false, commandIDs);
  }
};

const sendTOTDMessage = async (client, channel, message, commandMessage) => {
  try {
    console.log(`Sending current TOTD to #${channel.name} in ${channel.guild.name}`);
    const discordMessage = await utils.sendMessage(channel, message, commandMessage);
    // add rating emojis
    const emojis = [];
    for (let i = 0; i < constants.ratingEmojis.length; i++) {
      emojis.push(utils.getEmojiMapping(constants.ratingEmojis[i]));
    }
    for (const emoji of emojis) {
      discordMessage.react(emoji);
    }
    return Promise.resolve(discordMessage);
  } catch (error) {
    console.log(`Couldn't send TOTD message to #${channel.name} in ${channel.guild.name}, throwing error`);
    console.error(error);
    return Promise.reject(error);
  }
};

const sendTOTDLeaderboard = async (client, channel, commandMessage) => {
  const discordMessage = await utils.sendMessage(channel, `Fetching current leaderboard, give me a second... ${utils.getEmojiMapping(`Loading`)}`, commandMessage);

  const leaderboardMessage = await getTOTDLeaderboardMessage();

  console.log(`Sending current leaderboard to #${channel.name} in ${channel.guild.name}`);
  discordMessage.edit(leaderboardMessage);
};

const sendTOTDRatings = async (client, channel, mapUid, commandMessage) => {
  const redisClient = await redisAPI.login();
  const today = await redisAPI.getCurrentTOTD(redisClient);

  let mapInfo;
  if (mapUid === today.mapUid) {
    mapInfo = today;
    mapInfo.today = true;
    mapInfo.ratings = await redisAPI.getTOTDRatings(redisClient);
  } else {
    const storedTOTDs = await redisAPI.getAllStoredTOTDs(redisClient);
    mapInfo = storedTOTDs[mapUid];
  }

  const ratingString = mapInfo?.today ? `current rating` : `previous verdict (${mapInfo?.day}/${mapInfo?.month}/${mapInfo?.year})`;
  console.log(`Sending ${ratingString} to #${channel.name} in ${channel.guild.name}`);
  const message = await getRatingMessage(mapInfo);
  await utils.sendMessage(channel, message, commandMessage);
  redisAPI.logout(redisClient);
};

const sendBingoBoard = async (channel, lastWeek, commandMessage, commandIDs) => {
  const bingoString = lastWeek ? `last week's` : `current`;
  console.log(`Sending ${bingoString} bingo board to #${channel.name} in ${channel.guild.name}`);
  const message = await getBingoMessage(channel.guildId, lastWeek, false, commandIDs);
  await utils.sendMessage(channel, message, commandMessage);
};

const sendBingoVote = async (channel, bingoID, commandMessage) => {
  const redisClient = await redisAPI.login();
  let board = await redisAPI.getBingoBoard(redisClient, channel.guildId);

  if (!board) {
    return await utils.sendMessage(channel, `There's no board yet, why are you trying to vote? You can use \`/bingo\` to generate this server's board for this week.`);
  }

  // add free space to the center
  board.splice(12, 0, {text: `Free space`, checked: false});

  if (bingoID < 1 || bingoID > 25) {
    return await utils.sendMessage(channel, `Hmm, that's not on the board. I only understand numbers from 1 to 25 I'm afraid.`, commandMessage);
  } else if (bingoID === 13) {
    return await utils.sendMessage(channel, `You want to vote on the free space? Are you okay?`, commandMessage);
  }

  const field = board[bingoID - 1];
  if (field.checked) {
    return await utils.sendMessage(channel, `Looks like that field is already checked off for this week.`, commandMessage);
  } else if (field.voteActive) {
    return await utils.sendMessage(channel, `There's already a vote going on for that field, check again tomorrow.`, commandMessage);
  }

  const textWithoutBreaks = field.text.replace(/\n/g, ` `);
  const voteMessage = await utils.sendMessage(
    channel,
    `Bingo vote started: **${textWithoutBreaks}**\n` +
      `Does that sound like today's track?\n` +
      `Vote using the reactions below - I'll close the vote when the next TOTD comes out.`,
    commandMessage
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
  await redisAPI.saveBingoBoard(redisClient, board, channel.guildId);
  return redisAPI.logout(redisClient);
};

const countBingoVotes = async (client) => {
  console.log(`Counting outstanding bingo votes...`);
  const redisClient = await redisAPI.login();
  let boards = await redisAPI.getAllBingoBoards(redisClient);

  const updatedFields = [];

  for (const [serverID, board] of Object.entries(boards)) {
    console.log(`Counting votes for ${serverID}`);
    for (let i = 0; i < board.length; i++) {
      const field = board[i];
      if (!field.checked && field.voteActive && field.voteMessageID && field.voteChannelID) {
        // vote found, resolving it
        let voteMessage;
        try {
          const voteChannel = await client.channels.fetch(field.voteChannelID);
          voteMessage = await voteChannel.messages.fetch(field.voteMessageID);
          if (!voteMessage) {
            throw new Error(`Message not found`);
          }

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
        } catch (error) {
          console.log(`Caught error fetching votes for field ${field.text}:`, error);
          // if message or channel can't be found, just remove the active vote
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

    await redisAPI.saveBingoBoard(redisClient, board, serverID);
  }
  return redisAPI.logout(redisClient);
};

const archiveRatings = async (client, oldTOTD) => {
  console.log(`Archiving existing ratings and clearing current ones...`);
  const redisClient = await redisAPI.login();
  const ratings = await redisAPI.getTOTDRatings(redisClient);

  console.log(`Old ratings:`, ratings);

  if (ratings) {
    const totds = await redisAPI.getAllStoredTOTDs(redisClient);
    totds[oldTOTD.mapUid] = {
      name: oldTOTD.name,
      authorName: oldTOTD.authorName,
      day: oldTOTD.day,
      month: oldTOTD.month,
      year: oldTOTD.year,
      ratings: ratings
    };
    await redisAPI.storeTOTDs(redisClient, totds);

    // send ratings to admin server
    console.log(`Sending verdict to admin server...`);
    const adminChannel = await client.channels.fetch(adminChannelID);
    utils.sendMessage(adminChannel, await getRatingMessage(totds[oldTOTD.mapUid]));
  }
  await redisAPI.clearTOTDRatings(redisClient);

  return await redisAPI.logout(redisClient);
};

const calculateRankings = async (timeframe) => {
  // timeframe has to use format "Month YYYY", "complete YYYY" or "all-time"
  const allTimeMode = timeframe === constants.specialRankings.allTime;
  const timeframeRegex = new RegExp(`(${luxon.Info.months(`long`).join(`|`)}|${constants.specialRankings.completeYear}) ([0-9]{4})`);
  const regexResult = timeframe.match(timeframeRegex);
  if (!regexResult && !allTimeMode) {
    throw new Error(`Can't find that time frame, make sure you've picked one of the suggested options.`);
  }

  const month = regexResult?.[1];
  const year = regexResult?.[2];
  const yearMode = month === `complete`;

  // get all totds stats
  const redisClient = await redisAPI.login();
  const ratings = await redisAPI.getAllStoredTOTDs(redisClient);
  redisAPI.logout(redisClient);

  if (!ratings) {
    return {
      top: [],
      bottom: []
    };
  }

  let topMax = 10;
  let bottomMax = 5;

  // go through them from top to bottom and collect the top 10 and bottom 5
  let topRanking = [];
  let bottomRanking = [];
  for (const [mapUid, ratingData] of Object.entries(ratings)) {
    if (!allTimeMode) {
      if (ratingData.year != year) {
        if (topRanking.length > 0) {
          // if data has been collected and we run into this case, we've gone through all relevant data
          break;
        } else {
          continue;
        }
      } else {
        if (!yearMode && ratingData.month != month) {
          if (topRanking.length > 0) {
            // if data has been collected and we run into this case, we've gone through all relevant data
            break;
          } else {
            continue;
          }
        }
      }
    }

    ratingData.mapUid = mapUid;
    const {averageRating} = rating.calculateRatingStats(ratingData.ratings);
    ratingData.averageRating = averageRating;

    // go through top array - insert map if rating is higher than existing one
    let topInserted = false;
    for (let i = 0; i < topRanking.length; i++) {
      const topItem = topRanking[i];
      if (ratingData.averageRating > topItem.averageRating) {
        topRanking.splice(i, 0, ratingData);
        topInserted = true;
        break;
      }
    }
    // add to the back of the list if it hasn't been inserted yet
    if (!topInserted) {
      topRanking.push(ratingData);
    }
    // cut off excess rankings beyond the max
    if (topRanking.length > topMax) {
      topRanking = topRanking.slice(0, topMax);
    }

    // go through bottom array - insert map if rating is higher than existing one
    let bottomInserted = false;
    for (let i = 0; i < bottomRanking.length; i++) {
      const bottomItem = bottomRanking[i];
      if (ratingData.averageRating > bottomItem.averageRating) {
        bottomRanking.splice(i, 0, ratingData);
        bottomInserted = true;
        break;
      }
    }
    // add to the back of the list if it hasn't been inserted yet
    if (!bottomInserted) {
      bottomRanking.push(ratingData);
    }
    // cut off excess rankings beyond the max
    if (bottomRanking.length > bottomMax) {
      bottomRanking = bottomRanking.slice(-bottomMax);
    }
  }

  return {
    top: topRanking,
    bottom: bottomRanking
  };
};

const distributeTOTDMessages = async (client, oldTOTDOverride) => {
  // get cached TOTD for ratings
  const redisClient = await redisAPI.login();
  const oldTOTD = await redisAPI.getCurrentTOTD(redisClient);

  console.log(`Broadcasting TOTD message to subscribed channels`);
  let message;
  try {
    message = await getTOTDMessage(true);
  } catch (error) {
    console.error(`Failed to get TOTD message during distribution`, error);
  }

  let retryCount = 0;
  while (
    retryCount < 3
    && (!message || (oldTOTD.mapUid === message.embeds[0].footer.text && !oldTOTDOverride))
  ) {
    // retries left + either no message or the same UID as the existing one (manual override disabled)
    console.warn(`No new TOTD message available, refetching in a few seconds`);
    retryCount++;
    try {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      message = await getTOTDMessage(true);
    } catch (error) {
      console.error(`Failed refetch`, error);
    }
  }

  if (!oldTOTDOverride || !message) {
    // no override or no message at all, so check whether we need to fail distribution
    if (!message || oldTOTD.mapUid === message.embeds[0].footer.text) {
      // still the old map, fail the TOTD distribution
      console.error(`Retries failed, aborting TOTD distribution`);
      return;
    }
  }

  await archiveRatings(client, oldTOTD);
  await redisAPI.clearIndividualRatings(redisClient);
  countBingoVotes(client);

  const configs = await redisAPI.getAllConfigs(redisClient);

  const distributeTOTDMessage = async (config, initialMessage) => {
    try {
      const channel = await client.channels.fetch(config.channelID);
      const totdMessage = await sendTOTDMessage(client, channel, message);

      if (initialMessage && totdMessage.embeds[0]?.image?.url) {
        console.log(`Writing back initial message's thumbnail URL to Redis and future posts`);
        message.embeds[0].image.url = totdMessage.embeds[0]?.image?.url;
        delete message.files;

        const updatedTOTD = await redisAPI.getCurrentTOTD(redisClient);
        await redisAPI.saveCurrentTOTD(redisClient, {...updatedTOTD, thumbnailUrl: totdMessage.embeds[0]?.image?.url});
        redisAPI.logout(redisClient);
      }
    } catch (error) {
      //let retryCount = 0;
      if (error.message === `Missing Access` || error.message === `Missing Permissions` || error.message === `Unknown Channel`) {
        console.log(`Missing access or permissions, bot was probably kicked from server ${config.serverID} - removing config`);
        const redisClientForRemoval = await redisAPI.login();
        await redisAPI.removeConfig(redisClientForRemoval, config.serverID);
        redisAPI.logout(redisClientForRemoval);
      } else {
        // no need to log user abort errors, those are just Discord API problems
        if (error.message !== `The user aborted a request.`) {
          console.error(`Unexpected error during TOTD distribution for ${config.serverID}: ${error.message}`);
        }

        // always log the error and notify the admin
        console.error(error);
        const adminChannel = await client.channels.fetch(adminChannelID);
        utils.sendMessage(adminChannel, `Unexpected error during TOTD distribution, check logs.`);

        // disable retry logic in here for now
        /* while (retryCount < 3) {
          retryCount++;
          // Discord API error, retry sending the message
          console.warn(`Discord API error during TOTD distribution for ${config.serverID}, retrying... (${retryCount})`);

          try {
            const channel = await client.channels.fetch(config.channelID);
            await sendTOTDMessage(client, channel, message);
            return;
          } catch (retryError) {
            if (retryError.message !== `The user aborted a request.`) {
              console.error(`Unexpected error during TOTD distribution for ${config.serverID} (${retryCount}): ${retryError.message}`);
              console.error(retryError);
            }
          }
        }

        console.error(`Failed to send TOTD message after 3 retries, giving up`); */
        return;
      }
    }
  };

  // send the first message in a blocking way to store the image URL
  console.log(`Sending out the first TOTD message before posting the rest`);
  await distributeTOTDMessage(configs.shift(), true);
  console.log(`Initial TOTD message processed, continuing with the rest`);
  for (const [configIndex, config] of configs.entries()) {
    if (configIndex % 25 === 0 && configIndex !== 0) {
      // wait a few seconds before continuing to definitely avoid hitting Discord API rate limit
      await new Promise(resolve => setTimeout(resolve, 15000));
      console.log(`Waiting 15 seconds before sending TOTD message to next batch of servers...`);
    }
    distributeTOTDMessage(config, false);
  }
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
        utils.sendMessage(channel, `${config[roleProp]} The Cup of the Day is about to begin! ${utils.getEmojiMapping(`COTDPing`)} Ten minutes to go!`);
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

const updateTOTDReactionCount = async (reaction, add, user) => {
  // check that the message really is the current TOTD
  const redisClient = await redisAPI.login();
  const totd = await redisAPI.getCurrentTOTD(redisClient);

  if (reaction.message.partial || reaction.message.embeds.length === 0) {
    console.log(`Reaction message is partial, fetching...`);
		try {
			await reaction.message.fetch();
		} catch (error) {
			console.error(`Something went wrong when fetching the full reaction message: `, error);
			return;
		}
  }

  // use the mapUid to check if this is the current TOTD
  const currentMapUid = totd.mapUid;
  const reactionMapUid = utils.removeNameFormatting(
    reaction.message?.embeds[0]?.footer?.text?.trim()
  );
  if (currentMapUid === reactionMapUid || reactionMapUid === undefined) { // weird edge case: embed might be missing, but it's still a valid reaction
    const ratingEmojis = constants.ratingEmojis;
    let ratingEmojiFound = false;
    for (let i = 0; i < ratingEmojis.length; i++) {
      const ratingIdentifier = utils.getEmojiMapping(ratingEmojis[i]);

      if (ratingIdentifier.includes(reaction.emoji.identifier)) {
        ratingEmojiFound = true;
        // check if this is a valid rating (i.e. not a duplicate from this user)
        const valid = await redisAPI.updateIndividualRatings(redisClient, reaction.emoji.name, add, user.id);
        const emojiInfo = `[${user.tag} ${add ? `added` : `removed`} ${reaction.emoji.name}]`;
        if (valid) {
          // update the reaction count
          console.log(`Rating reaction in #${reaction.message.channel.name} (${reaction.message.channel.guild.name}) ${emojiInfo}`);
          await redisAPI.updateTOTDRatings(redisClient, ratingEmojis[i], add);
        } else {
          console.log(`Rating reaction in #${reaction.message.channel.name} (${reaction.message.channel.guild.name}) ${emojiInfo} [duplicate]`);
        }
        break;
      }
    }
    if (!ratingEmojiFound) {
      await reaction.remove();
    }
    redisAPI.logout(redisClient);
  } else {
    console.log(`Ignored reaction: (${reaction.emoji.identifier} ${add ? `added` : `removed`} for mapUid "${reactionMapUid}")`);
    // ignored, close the redis connection
    redisAPI.logout(redisClient);
  }
};

const sendErrorMessage = (channel) => {
  utils.sendMessage(channel, errorMessage);
};

module.exports = {
  sendTOTDMessage,
  getTOTDMessage,
  getTOTDLeaderboardMessage,
  getBingoMessage,
  archiveBingoBoards,
  sendErrorMessage,
  sendTOTDLeaderboard,
  sendTOTDRatings,
  sendBingoBoard,
  sendBingoVote,
  countBingoVotes,
  distributeTOTDMessages,
  sendCOTDPings,
  updateTOTDReactionCount,
  archiveRatings,
  calculateRankings
};
