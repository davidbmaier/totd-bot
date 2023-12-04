const Discord = require(`discord.js`);
const Canvas = require(`canvas`);
const luxon = require(`luxon`);
const path = require(`path`);

const utils = require(`./utils`);
const rating = require(`./rating`);
const constants = require(`./constants`);

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

const formatTOTDMessage = (totd) => {
  // assemble title
  let trackLabel = `Track`;
  if (totd.tmxTags && totd.tmxTags.includes(`Scenery`)) {
    trackLabel = `Scenery`;
  }
  if (totd.tmxTags && totd.tmxTags.includes(`Nascar`)) {
    trackLabel = `Nascar`;
  }
  if (totd.tmxTags && totd.tmxTags.includes(`LOL`)) {
    trackLabel = `LOL`;
  }

  const title = `**Here's the ${totd.month} ${utils.formatDay(totd.day)} ${trackLabel} of the Day!**`;

  // assemble track info
  let trackName = totd.name;
  if (totd.tmxName) {
    trackName = totd.tmxName;
  } else {
    trackName = utils.removeNameFormatting(totd.name);
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

  const embed = {
    title: title,
    type: `rich`,
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
        name: `Medal Times`,
        value: `${author}\n${gold}\n${silver}\n${bronze}`,
        inline: true
      },
      {
        name: `Links`,
        value: links
      }
    ],
    footer: {
      text: totd.mapUid
    }
  };

  // always add the Nadeo timestamp
  embed.fields.splice(2, 0, {
      name: `Last uploaded to Nadeo servers`,
      // parse ISO 8601 to UNIX timestamp (since that's what Discord's formatting requires)
      value: `<t:${Math.trunc(Date.parse(totd.timestamp) / 1000)}:R>`,
    });

  if (totd.tmxTimestamp) {
    // if TMX timestamp exists, add that as well (along with styles if they're available)
    embed.fields.splice(3, 0, {
      name: `Uploaded to TMX`,
      // parse ISO 8601 to UNIX timestamp (since that's what Discord's formatting requires)
      value: `<t:${Math.trunc(Date.parse(totd.tmxTimestamp) / 1000)}:R>`,
    });

    if (styles) {
      embed.fields.splice(5, 0, {
        name: `Styles (according to TMX)`,
        value: styles,
        inline: true
      });
    }
  }

  const messageObject = {
    embeds: [embed]
  };

  if (totd.thumbnailUrl?.includes(`discordapp.com`)) {
    // if the image is hosted on Discord, just use the link
    embed.image = {
      url: totd.thumbnailUrl
    };
  } else {
    // if the image is external, upload the file itself
    const thumbnailAttachment = new Discord.MessageAttachment(totd.thumbnailUrl, `totd.png`);
    // to attach the image, it needs to be sent along as a file
    messageObject.files = [thumbnailAttachment];
    embed.image = {
      url: `attachment://totd.png`
    };
  }

  return messageObject;
};

const formatLeaderboardMessage = (totd, records, date) => {
  const topTen = records.slice(0, 10);
  let top100 = records.find((record) => record.position === 100);
  let top1k = records.find((record) => record.position === 1000);
  let top10k = records.find((record) => record.position === 10000);

  const times = topTen.map((top) => formatTime(top.score.toString()));
  const positions = topTen.map((top) => top.position);
  const names = topTen.map((top) => top.playerName);

  // assemble makeshift table using spaces
  let topTenField = `\`\`\`\n        Time       Name\n`;
  for (let i = 0; i < topTen.length; i++) {
    const positionString = positions[i].toString().length > 1 ? ` ${positions[i]}   ` : ` ${positions[i]}    `;
    const timeString = `${times[i]}  `;
    const nameString = names[i];
    topTenField += `${positionString}${timeString}${nameString}\n`;
  }

  topTenField += `\n\`\`\``;

  const formattedMessage = {
    content: null, // remove placeholder content during load
    embeds:[{
      title: `Here's today's TOTD leaderboard!`,
      description: `Data from <t:${date}:R>`,
      type: `rich`,
      fields: [
        {
          name: `Top 10`,
          value: topTenField
        },
        {
          name: `Links`,
          value: `More detailed leaderboards on [TM.io](https://trackmania.io/#/totd/leaderboard/${totd.seasonUid}/${totd.mapUid})`
        }
      ]
    }],
    date: date // used for caching
  };

  if (top100 || top1k || top10k) {
    let thresholdText = `\`\`\`\n`;
    if (top100) {
      thresholdText += `Top 100: ${formatTime(top100.score.toString())}\n`;
    }
    if (top1k) {
      thresholdText += `Top 1k:  ${formatTime(top1k.score.toString())}\n`;
    }
    if (top10k) {
      thresholdText += `Top 10k: ${formatTime(top10k.score.toString())}\n`;
    }
    thresholdText += `\`\`\``;

    formattedMessage.embeds[0].fields.splice(1, 0, {
      name: `Trophy Thresholds`,
      value: thresholdText
    });
  }

  return formattedMessage;
};

const formatRatingsMessage = (mapInfo) => {
  let formattedRatings = ``;

  const orderedRatings = {
    MinusMinusMinus: mapInfo.ratings.MinusMinusMinus,
    MinusMinus: mapInfo.ratings.MinusMinus,
    Minus: mapInfo.ratings.Minus,
    Plus: mapInfo.ratings.Plus,
    PlusPlus: mapInfo.ratings.PlusPlus,
    PlusPlusPlus: mapInfo.ratings.PlusPlusPlus
  };
  for (const item in orderedRatings) {
    const rating = mapInfo.ratings[item];
    // add it to the front since the ratings go from --- to +++
    formattedRatings = `${utils.getEmojiMapping(item)} - ${rating}\n${formattedRatings}`;
  }

  const stats = rating.calculateRatingStats(mapInfo.ratings);

  let verdict = `Total ratings: ${stats.totalVotes}\n`;
  if (stats.totalVotes > 0) {
    verdict += `Average rating: ${stats.averageRating}\n`;
    verdict += `Average karma: ${stats.averageKarma}\n`;
  }

  verdict += `\n`;

  // provisional check for how controversial the votes are (may need some adjustment down the road)
  const checkForControversialVotes = () => stats.averagePositive > 2 && stats.averageNegative > 2;

  if (stats.totalVotes === 0) {
    verdict += `Looks like I didn't get any votes for this map...`;
  } else if (checkForControversialVotes() && -0.5 <= stats.averageRating && stats.averageRating < 0.5) {
    verdict += `A bit of a controversial one - let's agree on *interesting*.`;
  } else if (stats.averageRating < -2) {
    verdict += `Best to just forget about this one, huh?`;
  } else if (stats.averageRating < -1) {
    verdict += `Not really well-liked, but it could still be worse.`;
  } else if (stats.averageRating < 0) {
    verdict += `Not great, not terrible.`;
  } else if (stats.averageRating < 1) {
    verdict += `An alright track, but there's some room for improvement.`;
  } else if (stats.averageRating < 2) {
    verdict += `Pretty good track, definitely worth playing.`;
  } else {
    verdict += `Absolutely fantastic track, definitely a highlight!`;
  }

  let description = ``;
  if (mapInfo?.name) {
    description = `**${utils.removeNameFormatting(mapInfo.name)}** by **${mapInfo.authorName}** (${mapInfo.month} ${utils.formatDay(mapInfo.day)} ${mapInfo.year})`;
  }

  return {
    embeds: [{
      title:
        mapInfo.formatDay
          ? `Here are today's TOTD ratings!`
          : `Here are the TOTD ratings!`,
      type: `rich`,
      description: description,
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
      ],
      footer: {
        text: mapInfo.today
          ? `This track is still being voted on, so take these numbers with a grain of salt.`
          : `These ratings aren't just from here - I collect feedback from a bunch of other servers as well!`
      }
    }]
  };
};

const resolveRatingToEmoji = (rating) => {
  const mappings = [
    { value: 2.5, emoji: utils.getEmojiMapping(`PlusPlusPlus`) },
    { value: 1.5, emoji: utils.getEmojiMapping(`PlusPlus`) },
    { value: 0, emoji: utils.getEmojiMapping(`Plus`) },
    { value: -1.5, emoji: utils.getEmojiMapping(`Minus`) },
    { value: -2.5, emoji: utils.getEmojiMapping(`MinusMinus`) },
    { value: -3, emoji: utils.getEmojiMapping(`MinusMinusMinus`) },
  ];

  for (let i = 0; i < mappings.length; i++) {
    const mapping = mappings[i];
    if (rating >= mapping.value) {
      return mapping.emoji;
    }
  }
};

const formatRankingMessage = (rankings, timeframe) => {
  // if top and bottom are empty, return a basic placeholder
  if (rankings?.top.length === 0 || rankings?.bottom.length === 0) {
    return `It seems I don't have any data for that timeframe yet, sorry!`;
  }

  const currentYear = luxon.DateTime.now().year;
  const currentMonth = luxon.DateTime.now().monthLong;

  const formatRatingNumber = (rating) => {
    let ratingString = `${rating}`;
    if (!ratingString.includes(`.`)) {
      ratingString += `.0`;
    }
    return ratingString;
  };

  const formatRankingRows = (rankingItems) => {
    let section = ``;
    rankingItems.forEach((rankingItem) => {
      // resolve rating to emoji
      const rating = `${resolveRatingToEmoji(rankingItem.averageRating)} \`${formatRatingNumber(rankingItem.averageRating)}\``;
      let date = `${rankingItem.month} ${utils.formatDay(rankingItem.day)}`;
      if (timeframe === constants.specialRankings.allTime) {
        // add the year if the ranking goes across multiple years
        date += ` ${rankingItem.year}`;
      }
      const mapLink = `https://trackmania.io/#/leaderboard/${rankingItem.mapUid}`;
      // escape Discord formatting characters
      const authorName = rankingItem.authorName.replace(/[_>*~|`]/g, `\\$&`);
      const voteCount = Object.values(rankingItem.ratings).reduce((sum, value) => sum + value, 0);

      // ++ (rating) date - mapName (mapAuthor)
      const row = `${rating} ${date} - [${utils.removeNameFormatting(rankingItem.name)}](${mapLink}) by **${authorName}** (${voteCount} votes)\n`;
      section += row;
    });
    return section;
  };

  const embed = {
    // set title based on the type
    title: `Here are the ${timeframe} TOTD rankings!`,
    type: `rich`,
    fields: [
      {
        name: `Top ${rankings.top.length}`,
        value: formatRankingRows(rankings.top.slice(0, 5)),
      },
      {
        name: `Bottom ${rankings.bottom.length}`,
        value: formatRankingRows(rankings.bottom),
      }
    ]
  };

  if (rankings.top.length > 5) {
    embed.fields[0].name = `Top ${rankings.top.length}`;
    embed.fields.splice(1, 0, {
      name: ` `,
      value: formatRankingRows(rankings.top.slice(5, rankings.top.length)),
    },);
  }

  // add disclaimer to footer that month isn't over yet
  if (timeframe.includes(currentYear) && timeframe.includes(currentMonth)) {
    const description1 = `The month isn't over yet, so these aren't final -`;
    const description2 = `check again when it's over to see the final rankings!`;
    embed.footer = {
      text: `${description1} ${description2}`
    };
  } else if (timeframe === `${constants.specialRankings.completeYear} ${currentYear}`) {
    const description1 = `The year isn't over yet, so these aren't final -`;
    const description2 = `check again when it's over to see the final rankings!`;
    embed.footer = {
      text: `${description1} ${description2}`
    };
  }
  // for allTime/year 2021 add disclaimer to footer
  if (timeframe === `all-time` || timeframe === `${constants.specialRankings.completeYear} 2021`) {
    const footer = `This ranking only displays data starting from July 2021.`;
    embed.footer = {
      text: `${footer}`
    };
  }

  return {embeds: [embed]};
};

const formatBingoBoard = async (fields, lastWeek, commandIDs) => {
  // add free space to the center
  fields.splice(12, 0, {text: `Free space`, checked: true});

  Canvas.registerFont(path.resolve(`./src/fonts/Quicksand.ttf`), {family: `Quicksand`});
  const fontName = `Quicksand`;

  // 5x5 board, each field is 160x90
  // borders around the board and each field as 2px wide
  // inline padding is 10px on each side -> inside width is 140px
  const canvas = Canvas.createCanvas(812, 462);
  const ctx = canvas.getContext(`2d`);

  const board = await Canvas.loadImage(`./src/backgrounds/bingoTemplate.png`);
  ctx.drawImage(board, 0, 0, canvas.width, canvas.height);

  // set alpha to .5 only for the background image
  ctx.globalAlpha = 0.5;

  // get the current week number (current time in Europe/Paris)
  let date = luxon.DateTime.fromMillis(new Date().getTime(), { zone: `Europe/Paris` });
  if (lastWeek) {
    // subtract 7 days for last week
    date = date.minus({ days: 7 });
  }
  // subtract 19hrs for the correct week (offset by the Monday TOTD)
  date = date.minus({ hours: 19 });
  const weekNumber = date.weekNumber;

  // translate the weekNumber into one of the 23 background images
  const backgroundNo = weekNumber % 23;
  const background = await Canvas.loadImage(`./src/backgrounds/${backgroundNo}.jpg`);
  ctx.drawImage(background, 2, 2, canvas.width - 4, canvas.height - 4);

  ctx.globalAlpha = 1;

  ctx.font = `18px ${fontName} medium`;
  ctx.textAlign = `center`;
  ctx.textBaseline = `middle`;
  ctx.fillStyle = `#FFFFFF`;

  let fieldCount = 0;
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      if (ctx.measureText(fields[fieldCount].text || fields[fieldCount]).width > 140) {
        console.log(`Bingo warning: Field is too long for one line:`, fields[fieldCount].text || fields[fieldCount]);
      }

      const textPieces = (fields[fieldCount].text || fields[fieldCount]).split(`\n`);

      // skip x cells incl their left border, then move to the cell center (incl the border)
      const horizontalCenter = (x * 162) + 82;
      // skip y cells incl their upper border, then move to the cell center (incl the border)
      const verticalCenter = (y * 92) + 47;
      const cellRight = horizontalCenter + 80;
      const cellLeft = horizontalCenter - 80;
      const cellTop = verticalCenter - 45;
      const cellBottom = verticalCenter + 45;

      // add dark backgrounds and highlighted edges to checked fields
      if (fields[fieldCount].checked) {
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = `#000000`;
        ctx.fillRect(cellLeft, cellTop, 160, 90);

        ctx.setLineDash([]);
        ctx.strokeStyle = `#a4eb34`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cellLeft, cellTop);
        ctx.lineTo(cellRight, cellTop);
        ctx.lineTo(cellRight, cellBottom);
        ctx.lineTo(cellLeft, cellBottom);
        ctx.lineTo(cellLeft, cellTop);
        ctx.stroke();
        // add dashed edges to fields that are being voted on
      } else if (fields[fieldCount].voteActive) {
        ctx.globalAlpha = 0.65;
        ctx.fillStyle = `#000000`;
        ctx.fillRect(cellLeft, cellTop, 160, 90);

        ctx.strokeStyle = `#ebe834`;
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cellLeft, cellTop);
        ctx.lineTo(cellRight, cellTop);
        ctx.lineTo(cellRight, cellBottom);
        ctx.lineTo(cellLeft, cellBottom);
        ctx.lineTo(cellLeft, cellTop);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;

      // write field text
      for (let i = 0; i < textPieces.length; i++) {
        // (full height / spaces between text pieces) * piece index = offset for this specific piece
        const pieceOffset = (90 / (textPieces.length + 1)) * (i + 1);

        const currentHeight = cellTop + pieceOffset - 2; // move height up to correct for the font's line-height
        ctx.font = `18px ${fontName} medium`;
        ctx.textAlign = `center`;
        ctx.textBaseline = `middle`;
        ctx.fillStyle = `#FFFFFF`;
        ctx.fillText(textPieces[i], horizontalCenter, currentHeight);
      }

      // write field numbers
      ctx.font = `14px ${fontName} medium`;
      ctx.textAlign = `end`;
      ctx.textBaseline = `top`;
      // color the field numbers if the field has been checked
      if (fields[fieldCount].checked) {
        ctx.fillStyle = `#a4eb34`;
      } else {
        ctx.fillStyle = `#FFFFFF`;
      }

      ctx.fillText(fieldCount + 1, cellRight - 3, cellTop); // move font right into the corner

      fieldCount++;
    }
  }

  const attachment = new Discord.MessageAttachment(canvas.toBuffer(), `bingo.png`);

  const embedDescription =
    lastWeek
      ? `This board is closed - use ${utils.formatCommand(`bingo`, commandIDs)} to see the current one.`
      : `If you think we should cross one of these off, you can start a vote using ${utils.formatCommand(`votebingo`, commandIDs)}.`;

  const embed = {
    title: `Here's your server's TOTD bingo board for week ${weekNumber}!`,
    description: embedDescription,
    type: `rich`,
    image: {
      url: `attachment://bingo.png`
    }
  };

  const checkBingoWin = () => {
    for (let i = 0; i < 5; i++) {
      // column checks
      if (
        // column checks (0+5, 1+5, 2+5, 3+5, 3+5)
        (fields[i].checked && fields[i + 5].checked && fields[i + 10].checked && fields[i + 15].checked && fields[i + 20].checked)
        // row checks (0-4, 5-9, 10-14, 15-19, 20-24)
        || (fields[i * 5].checked && fields[i * 5 + 1].checked && fields[i * 5 + 2].checked && fields[i * 5 + 3].checked && fields[i * 5 + 4].checked)
        // diagonal checks (0+6, 4+4)
        || (fields[0].checked && fields[6].checked && fields[12].checked && fields[18].checked && fields[24].checked)
        || (fields[4].checked && fields[8].checked && fields[12].checked && fields[16].checked && fields[20].checked)
      ) {
        return true;
      }
    }
    return false;
  };

  if (checkBingoWin()) {
    embed.fields = [
      {
        name: `:tada: Bingo! :tada:`,
        value: `You've done it! Congrats! ${utils.getEmojiMapping(`Bingo`)}`
      }
    ];
  }

  return {embeds: [embed], files: [attachment]};
};

const formatHelpMessage = (commands, adminCommands) => {
  const embed = {
    title: `Hey, I'm the Track of the Day Bot!`,
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
          `I've been developed by tooInfinite (<@141627532335251456>) - feel free to talk to him if you've got any feedback or ran into any issues with me. \
          My code can be found [here](https://github.com/davidbmaier/totd-bot). \n\
          If you want to, you can [help pay for my hosting](https://github.com/sponsors/davidbmaier). Never required, always appreciated! \n\
          To invite me to your own server, click [here](https://discord.com/api/oauth2/authorize?client_id=807920588738920468&permissions=388160&scope=applications.commands%20bot).`
      }
    ]
  };

  if (adminCommands) {
    embed.fields.splice(1, 0, {
      name: `Admin commands`,
      value: adminCommands
    });
  }

  return {embeds: [embed]};
};

const formatInviteMessage = (title, message) => {
  const inviteLink = `For the invite link, click [here](https://discord.com/api/oauth2/authorize?client_id=807920588738920468&permissions=388160&scope=applications.commands%20bot)!`;
  return {
    embeds: [{
      type: `rich`,
      title: title || `Want to invite me to your own server?`,
      description: `${message || ``}\n${inviteLink}`,
    }]
  };
};

const formatProxyMessage = (message) => {
  return {
    embeds: [{
      title: `I just got mentioned!`,
      type: `rich`,
      fields: [
        {
          name: `Author`,
          value: message.author.tag,
          inline: true
        },
        {
          name: `Server`,
          value: message.guild.name,
          inline: true
        },
        {
          name: `Content`,
          value: message.content
        },
        {
          name: `Link`,
          value: `[Message](https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id})`
        }
      ]
    }]
  };
};

module.exports = {
  formatTOTDMessage,
  formatLeaderboardMessage,
  formatRankingMessage,
  formatRatingsMessage,
  formatHelpMessage,
  formatBingoBoard,
  formatInviteMessage,
  formatProxyMessage
};
