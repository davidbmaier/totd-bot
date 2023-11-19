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

module.exports = {
  calculateRatingStats,
};
