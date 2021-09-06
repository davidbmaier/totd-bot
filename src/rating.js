const constants = require(`./constants`);
const utils = require(`./utils`);

const calculateRatingStats = (ratings) => {
  let totalPositive = 0;
  let totalNegative = 0;
  let weightedPositive = 0;
  let weightedNegative = 0;
  let karmaPositive = 0;
  let karmaNegative = 0;
  let averageRating;
  let averagePositive;
  let averageNegative;
  let averageKarma;

  for (const item in ratings) {
    const rating = ratings[item];

    if (item.includes(`Plus`)) {
      const weight = (item.match(/Plus/g) || []).length;
      weightedPositive += weight * rating;
      // 60 / 80 / 100
      karmaPositive += (60 + (weight - 1) * 20) * rating;
      totalPositive += rating;
    } else {
      const weight = (item.match(/Minus/g) || []).length;
      weightedNegative += weight * rating;
      // 0 / 20 / 40
      karmaNegative += (60 - weight * 20) * rating;
      totalNegative += rating;
    }
  }

  const weightedVotes = weightedPositive - weightedNegative;
  const totalVotes = totalPositive + totalNegative;
  const totalKarma = karmaPositive + karmaNegative;

  if (totalVotes > 0) {
    averageRating = Math.round(weightedVotes / totalVotes * 10) / 10;
    averagePositive = Math.round(weightedPositive / totalPositive * 10) / 10;
    averageNegative = Math.round(weightedNegative / totalNegative * 10) / 10;
    averageKarma = Math.round(totalKarma / totalVotes * 10) / 10;
  }

  return {
    totalVotes, weightedVotes, totalKarma, averageRating, averageKarma, averagePositive, averageNegative
  };
};

const insertRatingIntoRanking = (ranking, type, totd) => {
  const updatedRanking = {...ranking};
  let topMax = 5;
  let bottomMax = 3;

  if (type === constants.ratingRankingType.allTime) {
    topMax = 10;
    bottomMax = 5;
  }

  const rankingData = {
    averageRating: totd.averageRating,
    mapName: totd.tmxName || utils.removeNameFormatting(totd.name),
    mapAuthor: totd.authorName,
    mapUId: totd.mapUid,
    date: `${totd.month} ${utils.formatDay(totd.day)}`
  };

  // go through top array - insert map if rating is higher than existing one
  let topInserted = false;
  for (let i = 0; i < updatedRanking.top.length; i++) {
    const topItem = updatedRanking.top[i];
    if (totd.averageRating > topItem.averageRating) {
      updatedRanking.top.splice(i, 0, rankingData);
      topInserted = true;
      break;
    }
  }
  // add to the back of the list if it hasn't been inserted yet
  if (!topInserted) {
    updatedRanking.top.push(rankingData);
  }

  // cut off excess rankings beyond the max
  if (updatedRanking.top.length > topMax) {
    updatedRanking.top = updatedRanking.top.slice(0, topMax);
  }

  // go through bottom array - insert map if rating is lower than existing one
  let bottomInserted = false;
  for (let i = 0; i < updatedRanking.bottom.length; i++) {
    const bottomItem = updatedRanking.bottom[i];
    if (totd.averageRating < bottomItem.averageRating) {
      updatedRanking.bottom.splice(i, 0, rankingData);
      bottomInserted = true;
      break;
    }
  }
  // add to the back of the list if it hasn't been inserted yet
  if (!bottomInserted) {
    updatedRanking.bottom.push(rankingData);
  }

  // cut off excess rankings beyond the max
  if (updatedRanking.bottom.length > bottomMax) {
    updatedRanking.bottom = updatedRanking.bottom.slice(0, bottomMax);
  }

  return updatedRanking;
};

const updateRanking = (ratings, ranking, type, totd) => {
  const stats = calculateRatingStats(ratings);
  totd.averageRating = stats.averageRating;

  if (!stats.totalVotes) {
    console.log(`Skipping ranking updates as there are no votes`);
    return ranking;
  }

  const updatedRanking = insertRatingIntoRanking(ranking, type, totd);
  return updatedRanking;
};

module.exports = {
  calculateRatingStats,
  updateRanking
};
