require(`dotenv`).config();

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
  let cleanedText = text.replace(/(?<!\$)((?<d>\$+)\k<d>)?((?<=\$)(?!\$)|(\$([a-f\d]{1,3}|[ionmwsztg<>]|[lhp](\[[^\]]+\])?)))/gmi, ``);
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

const formatCommand = (name, commandIDs) => {
  if (commandIDs && commandIDs[name]) {
    return `</${name}:${commandIDs[name]}>`;
  }
  return `\`/${name}\``;
};

module.exports = {
  convertToUNIXSeconds,
  getMinutesAgo,
  getEmojiMapping,
  removeNameFormatting,
  formatDay,
  sendMessage,
  checkMessageAuthorForTag,
  formatCommand
};
