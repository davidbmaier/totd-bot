const Discord = require(`discord.js`);
const Canvas = require(`canvas`);
const path = require(`path`);

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

const formatBingoBoard = async (fields, lastWeek) => {
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

  // get the current week number
  let date = new Date();
  if (lastWeek) {
    date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // subtract 7 days for last week
  }
  date.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  // January 4 is always in week 1
  const week1 = new Date(date.getFullYear(), 0, 4);
  // adjust to Thursday in week 1 and count number of weeks from date to week 1
  const weekNumber =  1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);

  // translate the weekNumber into one of the 18 background images
  const backgroundNo = weekNumber % 18;
  const background = await Canvas.loadImage(`./src/backgrounds/${backgroundNo}.jpg`);
  ctx.drawImage(background, 2, 2, canvas.width - 4, canvas.height - 4);

  // draw a black rect in the center to highlight the free space (.5 alpha so it doesn't block the background)
  ctx.fillStyle = `#000000`;
  ctx.fillRect(326, 186, 160, 90);

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

      // add crosses to checked fields
      if (fields[fieldCount].checked) {
        ctx.strokeStyle = `#000000`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(cellLeft + 5, cellTop + 5); // top left
        ctx.lineTo(cellRight - 5, cellBottom - 5); // bottom right
        ctx.moveTo(cellRight - 5, cellTop + 5); // top right
        ctx.lineTo(cellLeft + 5, cellBottom - 5); // bottom left
        ctx.stroke();
      }

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
      ctx.fillStyle = `#FFFFFF`;
      ctx.fillText(fieldCount + 1, cellRight - 3, cellTop); // move font right into the corner

      fieldCount++;
    }
  }

  const attachment = new Discord.MessageAttachment(canvas.toBuffer(), `bingo.png`);

  const embedDescription = 
    lastWeek
      ? `This board is closed - use \`${utils.addDevPrefix(`!totd bingo`)}\` to see the current one.`
      : `If you think we should cross one of these off, you can start a vote using \`${utils.addDevPrefix(`!totd vote [1-25]`)}\`.`;

  const embed = {
    embed: {
      title: `Here's the TOTD bingo board for week ${weekNumber}!`,
      description: embedDescription,
      type: `rich`,
      files: [
        attachment
      ],
      image: {
        url: `attachment://bingo.png`
      }
    }
  };

  return embed;
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
  formatHelpMessage,
  formatBingoBoard
};
