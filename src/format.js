const formatTime = (time) => {
  const millisecs = time.substr(-3);
  let secs = time.substr(0, time.length - 3);
  // minutes/seconds need to be calculated
  const mins = Math.floor(secs / 60);
  secs = secs % 60;
  // pad the seconds if they're only a single digit
  if (secs < 10) {
    secs = secs.toString().padStart(2, `0`);
  }

  return `${mins}:${secs}.${millisecs}`;
};

const removeNameFormatting = (text) => {
  // this should take care of all the possible options, see https://doc.maniaplanet.com/client/text-formatting for reference
  let cleanedText = text.replace(/\$[0-9a-fA-F]{3}/, ``);
  cleanedText = cleanedText.replace(`$w`, ``);
  cleanedText = cleanedText.replace(`$n`, ``);
  cleanedText = cleanedText.replace(`$o`, ``);
  cleanedText = cleanedText.replace(`$b`, ``);
  cleanedText = cleanedText.replace(`$i`, ``);
  cleanedText = cleanedText.replace(`$t`, ``);
  cleanedText = cleanedText.replace(`$s`, ``);
  cleanedText = cleanedText.replace(`$g`, ``);
  cleanedText = cleanedText.replace(`$z`, ``);
  cleanedText = cleanedText.replace(`$$`, ``);
  return cleanedText;
};

const formatTOTDMessage = (totd) => {
  // assemble title
  const today = new Date();
  const month = today.getMonth();
  const day = today.getDate();

  const monthNames = [
    `January`,
    `February`,
    `March`,
    `April`,
    `May`,
    `June`,
    `July`,
    `August`,
    `September`,
    `October`,
    `November`,
    `December`
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

  let trackLabel = `Track`;
  if (totd.tmxTags && totd.tmxTags.includes(`Scenery`)) {
    trackLabel = `Scenery`;
  }

  const title = `**Here's the ${monthNames[month]} ${formatDay(day)} ${trackLabel} of the Day!**\n`;

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

  // assemble style info
  let styles;
  if (totd.tmxTags) {
    styles = `${totd.tmxTags.join(`, `)}`;
  }

  // assemble medal info
  const bronze = `<:MedalBronze:763718615764566016> Bronze`;
  const bronzeTime = `${formatTime(totd.bronzeScore.toString())}`;
  const silver = `<:MedalSilver:763718615689330699> Silver`;
  const silverTime = `${formatTime(totd.silverScore.toString())}`;
  const gold = `<:MedalGold:763718328685559811> Gold`;
  const goldTime = `${formatTime(totd.goldScore.toString())}`;
  const author = `<:MedalAuthor:763718159714222100> Author`;
  const authorTime = `${formatTime(totd.authorScore.toString())}`;

  // assemble links
  let links = `[TM.io](https://trackmania.io/#/totd/leaderboard/${totd.seasonUid}/${totd.mapUid})  `;

  if (totd.tmxTrackId) {
    links += `|  [TMX](https://trackmania.exchange/s/tr/${totd.tmxTrackId})`;
  }

  const scoreNote = `React to this message to rate the TOTD!`;

  const embed = {
    embed: {
      title: title,
      type: `rich`,
      image: {
        url: totd.thumbnailUrl
      },
      description: scoreNote,
      fields: [
        {
          name: `Name`,
          value: trackName,
          inline: true
        },
        {
          name: `Author`,
          value: trackAuthor,
          inline: true
        },
        {
          name: `Uploaded on`,
          value: new Date(totd.timestamp).toLocaleDateString(`en-US`, { year: `numeric`, month: `long`, day: `numeric` }),
          inline: true
        },
        {
          name: `Medals`,
          value: `${bronze}\n${silver}\n${gold}\n${author}`,
          inline: true
        },
        {
          name: `Times`,
          value: `${bronzeTime}\n${silverTime}\n${goldTime}\n${authorTime}`,
          inline: true
        },
        {
          name: `Links`,
          value: links
        }
      ]
    }
  };

  if (styles) {
    embed.embed.fields.splice(5, 0, {
      name: `Styles (according to TMX)`,
      value: styles,
      inline: true
    });
  }

  return embed;
};

const formatHelpMessage = (commands) => {
  return {
    embed: {
      title: `Hey, I'm TOTD Bot!`,
      type: `rich`,
      description: `Here's what you can tell me to do:`,
      fields: [
        {
          name: `Commands`,
          value: commands
        },
        {
          name: `More Info`,
          value:
            `I've been developed by <@141627532335251456> - feel free to let him know if you like me (or when something broke). \
            My code can be found [here](https://github.com/davidbmaier/todt-bot).`
        }
      ]
    }
  };
};

module.exports = {
  formatTOTDMessage,
  formatHelpMessage
};
