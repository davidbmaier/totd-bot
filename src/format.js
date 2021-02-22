const Discord = require(`discord.js`);

const utils = require(`./utils`);

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
  let cleanedText = text.replace(/\$[0-9a-fA-F]{3}/g, ``);
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
  if (totd.tmxTags && totd.tmxTags.includes(`Nascar`)) {
    trackLabel = `Nascar`;
  }

  const title = `**Here's the ${monthNames[month]} ${formatDay(day)} ${trackLabel} of the Day!**`;

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
  const bronze = `${utils.getEmojiMapping(`Bronze`)} ${formatTime(totd.bronzeScore.toString())}`;
  const silver = `${utils.getEmojiMapping(`Silver`)} ${formatTime(totd.silverScore.toString())}`;
  const gold = `${utils.getEmojiMapping(`Gold`)} ${formatTime(totd.goldScore.toString())}`;
  const author = `${utils.getEmojiMapping(`Author`)} ${formatTime(totd.authorScore.toString())}`;

  // assemble links
  let links = `[TM.io](https://trackmania.io/#/totd/leaderboard/${totd.seasonUid}/${totd.mapUid}) `;

  if (totd.tmxTrackId) {
    links += `| [TMX](https://trackmania.exchange/s/tr/${totd.tmxTrackId})`;
  }

  const scoreNote = `React to this message to rate the TOTD!`;

  const attachment = new Discord.MessageAttachment(totd.thumbnailUrl, `thumbnail.jpg`);
  const embed = {
    embed: {
      title: title,
      type: `rich`,
      files: [
        attachment
      ],
      image: {
        url: `attachment://thumbnail.jpg`
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
        },
        {
          name: `Medal Times`,
          value: `${bronze}\n${silver}\n${gold}\n${author}`,
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
    embed.embed.fields.splice(4, 0, {
      name: `Styles (according to TMX)`,
      value: styles,
      inline: true
    });
  }

  return embed;
};

const formatLeaderboardMessage = (totd, records, date) => {
  const topTen = records.slice(0, 10);
  const top100 = records[10];

  const times = topTen.map((top) => formatTime(top.score.toString()));
  const positions = topTen.map((top) => top.position);
  const names = topTen.map((top) => top.playerName);

  // assemble makeshift table using spaces
  let topTenField = `\`\`\`\n        Time        Name\n`;
  for (let i = 0; i < topTen.length; i++) {
    const positionString = positions[i].toString().length > 1 ? ` ${positions[i]}   ` : ` ${positions[i]}    `;
    const timeString = `${times[i]}  `;
    const nameString = names[i];
    topTenField += `${positionString}${timeString}${nameString}\n`;
  }

  topTenField += `\n\`\`\``;

  const embed = {
    date: date,
    content: ``,
    embed: {
      title: `Here's today's TOTD leaderboard!`,
      type: `rich`,
      fields: [
        {
          name: `Top 10`,
          value: topTenField
        },
        {
          name: `Top 100`,
          value: `To get top 100, you need to drive at least a **${formatTime(top100.score.toString())}**.`
        },
        {
          name: `Links`,
          value: `Full leaderboards on [TM.io](https://trackmania.io/#/totd/leaderboard/${totd.seasonUid}/${totd.mapUid})`
        }
      ],
      footer: {
        text: `The top 100 time is not exact - it might be slightly off by one or two positions.`
      }
    }
  };

  return embed;
};

const formatRatingsMessage = (ratings, yesterday) => {
  let formattedRatings = ``;
  let totalVotes = 0;
  let weightedVotes = 0;
  let averageRating;

  for (const item in ratings) {
    const rating = ratings[item];
    // add it to the front since the ratings go from --- to +++
    formattedRatings = `${utils.getEmojiMapping(item)} - ${rating}\n${formattedRatings}`;
    totalVotes += rating;

    if (item.includes(`Plus`)) {
      const weight = (item.match(/Plus/g) || []).length;
      weightedVotes += weight * rating;
    } else {
      const weight = (item.match(/Minus/g) || []).length;
      weightedVotes -= weight * rating;
    }
  }

  formattedRatings.slice(0, -2); // remove the last line break

  let verdict = `Total ratings: ${totalVotes}\n`;
  if (totalVotes > 0) {
    averageRating = Math.round(weightedVotes / totalVotes * 10) / 10;
    verdict += `Average rating: ${averageRating}\n`;
  }

  verdict += `\n`;
  
  if (totalVotes === 0) {
    if (yesterday) {
       verdict += `Looks like I didn't get any votes yesterday...`;
    } else {
      verdict += `Looks like I don't have any votes yet...`;
    }
  } else if (averageRating < -2) {
    verdict += `Looks like it was an absolute nightmare of a track!`;
  } else if (averageRating < -1) {
    verdict += `Best to just forget about this one, huh?`;
  } else if (averageRating < 0) {
    verdict += `Not exactly a good track, but it could have been worse.`;
  } else if (averageRating < 1) {
    verdict += `An alright track, nothing special though.`;
  } else if (averageRating < 2) {
    verdict += `Pretty good track today, but not quite perfect.`;
  } else {
    verdict += `Absolutely fantastic track, definitely a highlight!`;
  }

  return {
    embed: {
      title: 
        yesterday
          ? `Here are yesterday's TOTD ratings!`
          : `Here are today's TOTD ratings!`,
      type: `rich`,
      description:
        yesterday
          ? `These ratings aren't just from here - I collect feedback from a bunch of other servers as well!`
          : `This track is still being voted on, so take these numbers with a grain of salt.`,
      fields: [
        {
          name: `Ratings`,
          value: formattedRatings,
          inline: true
        },
        {
          name: `Verdict`,
          value: verdict,
          inline: true
        }
      ]
    }
  };
};

const formatHelpMessage = (commands) => {
  return {
    embed: {
      title: `Hey, I'm the TOTD Bot!`,
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
  formatLeaderboardMessage,
  formatRatingsMessage,
  formatHelpMessage
};
