const formatTime = (time) => {
  const millisecs = time.substr(-3);
  const secs = time.substr(-5, 2);
  const mins = 0;
  if (time.length > 6) {
    mins = time[0];
  }

  return `${mins}:${secs}.${millisecs}`;
};

const removeNameFormatting = (text) => {
  // this should take care of all the possible options, see https://doc.maniaplanet.com/client/text-formatting for reference
  let cleanedText = text.replace(/\$[0-9a-fA-F]{3}/, '');
  cleanedText = cleanedText.replace('$w', '');
  cleanedText = cleanedText.replace('$n', '');
  cleanedText = cleanedText.replace('$o', '');
  cleanedText = cleanedText.replace('$b', '');
  cleanedText = cleanedText.replace('$i', '');
  cleanedText = cleanedText.replace('$t', '');
  cleanedText = cleanedText.replace('$s', '');
  cleanedText = cleanedText.replace('$g', '');
  cleanedText = cleanedText.replace('$z', '');
  cleanedText = cleanedText.replace('$$', '');
  return cleanedText;
};

const formatTOTDMessage = (totd) => {
  // assemble title
  const today = new Date();
  const month = today.getMonth();
  const day = today.getDate();

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];

  const formatDay = (dayNum) => {
    if (dayNum === 1) {
      return `1st`;
    } else if (dayNum === 2) {
      return `2nd`;
    } else if (dayNum === 3) {
      return `3rd`;
    } else {
      return `${dayNum}th`;
    }
  };

  const title = `**The ${monthNames[month]} ${formatDay(day)} Track of the Day is now live!**\n`;

  // assemble track info
  let trackName = totd.name;
  if (totd.tmxName) {
    trackName = totd.tmxName;
  } else {
    trackName = removeNameFormatting(totd.name);
  }
  let trackAuthor = totd.author;
  if (totd.authorName) {
    trackAuthor = totd.authorName;
  } else if (totd.tmxAuthor) {
    trackAuthor = totd.tmxAuthor;
  }

  const track = `Today's track is **${trackName}** by **${trackAuthor}**.\n`;

  let style = ``;
  if (totd.tmxTags) {
    style = `Map styles (according to TMX): ${totd.tmxTags.join(', ')}\n`;
  }

  // assemble medal info
  const bronze = `<:MedalBronze:763718615764566016> Bronze: ||${formatTime(totd.bronzeScore.toString())}||\n`;
  const silver = `<:MedalSilver:763718615689330699> Silver: ||${formatTime(totd.silverScore.toString())}||\n`;
  const gold = `<:MedalGold:763718328685559811> Gold: ||${formatTime(totd.goldScore.toString())}||\n`;
  const author = `<:MedalAuthor:763718159714222100> Author: ||${formatTime(totd.authorScore.toString())}||\n`;

  const medals = `Medal times:\n${bronze}${silver}${gold}${author}\n`;
  const scoreNote = `React to this message to rate the TOTD!`;

  return `${title}${track}${style}${medals}${scoreNote}`;
};

module.exports = {
  formatTOTDMessage
};
