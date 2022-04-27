require(`dotenv`).config();

const deployMode = process.env.DEPLOY_MODE;

// add the prefix 'dev' to each command when not in prod mode
// (so you can test it without triggering the live bot as well - assuming you have both running with the same ID)
const addDevPrefix = (command) => {
  if (deployMode && deployMode !== `prod`) {
    // this assumes every command starts with '!'
    return `!dev${command.substr(1)}`;
  } else {
    return command;
  }
};

const convertToUNIXSeconds = (date) => {
  return Math.round(date.getTime()/1000);
};

const getMinutesAgo = (date) => {
  var seconds = Math.floor((new Date() - date) / 1000);
  var interval = seconds / 31536000;
  interval = seconds / 60;
  return Math.floor(interval);
};

const getEmojiMapping = (emojiName) => {
  const mapping = require(`../emojiMapping.json`);
  return mapping[emojiName] || ``;
};

const removeNameFormatting = (text = ``) => {
  // this should take care of all the possible options, see https://doc.maniaplanet.com/client/text-formatting for reference
  let cleanedText = text.replace(/\$[0-9a-fA-F]{3}/g, ``);
  cleanedText = cleanedText.replaceAll(`$w`, ``);
  cleanedText = cleanedText.replaceAll(`$n`, ``);
  cleanedText = cleanedText.replaceAll(`$m`, ``);
  cleanedText = cleanedText.replaceAll(`$o`, ``);
  cleanedText = cleanedText.replaceAll(`$b`, ``);
  cleanedText = cleanedText.replaceAll(`$i`, ``);
  cleanedText = cleanedText.replaceAll(`$I`, ``);
  cleanedText = cleanedText.replaceAll(`$t`, ``);
  cleanedText = cleanedText.replaceAll(`$s`, ``);
  cleanedText = cleanedText.replaceAll(`$S`, ``);
  cleanedText = cleanedText.replaceAll(`$g`, ``);
  cleanedText = cleanedText.replaceAll(`$z`, ``);
  cleanedText = cleanedText.replaceAll(`$$`, ``);
  return cleanedText;
};

const formatDay = (day) => {
  const dayNum = parseInt(day);
  if (dayNum === 1 || dayNum === 21 || dayNum === 31) {
    return `${dayNum}st`;
  } else if (dayNum === 2 || dayNum === 22) {
    return `${dayNum}nd`;
  } else if (dayNum === 3 || dayNum === 23) {
    return `${dayNum}rd`;
  } else {
    return `${dayNum}th`;
  }
};

const sendMessage = async (channel, message, commandMessage) => {
  if (commandMessage) {
    let messageObject = {};
    // add fetchReply depending on the message format
    if (typeof message === `string`) {
      messageObject = {
        content: message,
        fetchReply: true
      };
    } else {
      messageObject = {...message, fetchReply: true};
    }
    return await commandMessage.reply(messageObject);
  } else {
    return await channel.send(message);
  }
};

const checkMessageAuthorForTag = (msg, tag) => {
  const author = msg.author || msg.user;
  return author.tag === tag;
};

module.exports = {
  addDevPrefix,
  convertToUNIXSeconds,
  getMinutesAgo,
  getEmojiMapping,
  removeNameFormatting,
  formatDay,
  sendMessage,
  checkMessageAuthorForTag
};
