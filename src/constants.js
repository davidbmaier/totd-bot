const ratingEmojis = [
  `MinusMinusMinus`,
  `MinusMinus`,
  `Minus`,
  `Plus`,
  `PlusPlus`,
  `PlusPlusPlus`
];

const cupRegions = {
  europe: `Europe`,
  america: `America`,
  asia: `Asia`
};

const ratingRankingType = {
  lastMonthly: `lastMonthly`,
  monthly: `monthly`,
  yearly: `yearly`,
  lastYearly: `lastYearly`,
  allTime: `allTime`
};

const bingoFields = [
  // map styles
  `Tech of the Day`,
  `SpeedTech\nof the Day`,
  `Ice of the Day`,
  `Dirt of the Day`,
  `Grass\nof the Day`,
  `FullSpeed\nof the Day`,
  `Plastic\nof the Day`,
  // map characteristics
  `Scenery\nof the Day`,
  `Cut/Reroute\nof the Day`,
  `Fog of the Day`,
  `Restart\nsimulator`,
  `RGB lighting`,
  `Poor lighting`,
  `Night map`,
  `Map filled\nwith custom\nscenery items`,
  `Scenery\nin the middle\nof the road`,
  `Texture mod`,
  `Map outside\nof the stadium`,
  `Engine-off\nblock`,
  `Slowmo block`,
  `Cruise control`,
  `Reactor jump\nwith a zoop`,
  `Driving\nupside-down\n(e.g. loopings)`,
  `Speed slides`,
  `Jump into\nthe finish`,
  `Risky\nfinish`,
  `Narrow\nblocks`,
  `Poles on\nthe track`,
  `Multi-lap\ntrack`,
  `Questionable\ngears`,
  `Magnets`,
  `Moving items\non track`,
  `Water blocks\non track`,
  `Multiple\nroutes`,
  `Missable\nCP`,
  `Blind turn`,
  `Badly-placed\nCP`,
  // author
  `Author's\nfirst TOTD`,
  `Author already\nhad TOTD\nin the last 7 days`,
  `Multiple\nauthors`,
  // times
  `Author time\nover a minute`,
  `Author time\nunder 30s`,
  `Author medal\nthat's insanely\ndifficult`,
  `Free\nAuthor medal`,
  `No GPS`
];

module.exports = {
  ratingEmojis,
  cupRegions,
  bingoFields,
  ratingRankingType
};
