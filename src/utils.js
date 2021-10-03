require(`dotenv`).config();
const axios = require(`axios`);
const fs = require(`fs`);

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

const downloadThumbnail = (url, fileName) => {
  // create folder first
  try {
    fs.readdirSync(`./images`);
  } catch (error) {
    if (error.code === `ENOENT`) {
      fs.mkdirSync(`./images`);
    }
  }

  const writer = fs.createWriteStream(`./images/${fileName}`);

  return axios({
    method: `get`,
    url: url,
    responseType: `stream`,
  }).then(response => {
    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      let error;
      writer.on(`error`, err => {
        error = err;
        writer.close();
        reject(err);
      });
      writer.on(`close`, () => {
        if (!error) {
          resolve(`./images/${fileName}`);
        }
      });
    });
  });
};

const getEmojiMapping = (emojiName) => {
  const mapping = require(`../emojiMapping.json`);
  return mapping[emojiName] || ``;
};

const removeNameFormatting = (text = ``) => {
  // this should take care of all the possible options, see https://doc.maniaplanet.com/client/text-formatting for reference
  let cleanedText = text.replace(/\$[0-9a-fA-F]{3}/g, ``);
  cleanedText = cleanedText.replace(`$w`, ``);
  cleanedText = cleanedText.replace(`$n`, ``);
  cleanedText = cleanedText.replace(`$o`, ``);
  cleanedText = cleanedText.replace(`$b`, ``);
  cleanedText = cleanedText.replace(`$i`, ``);
  cleanedText = cleanedText.replace(`$t`, ``);
  cleanedText = cleanedText.replace(`$s`, ``);
  cleanedText = cleanedText.replace(`$S`, ``);
  cleanedText = cleanedText.replace(`$g`, ``);
  cleanedText = cleanedText.replace(`$z`, ``);
  cleanedText = cleanedText.replace(`$$`, ``);
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

module.exports = {
  addDevPrefix,
  downloadThumbnail,
  convertToUNIXSeconds,
  getMinutesAgo,
  getEmojiMapping,
  removeNameFormatting,
  formatDay
};
