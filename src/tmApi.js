const {
  loginUbi,
  loginTrackmaniaUbi,
  loginTrackmaniaNadeo,
  getMaps,
  getTOTDs,
  getProfiles,
  getProfilesById,
  getLeaderboardsAroundScore
} = require(`trackmania-api-node`);
require(`dotenv`).config();
const axios = require(`axios`);

const utils = require(`./utils`);

const uplayLogin = Buffer.from(process.env.USER_LOGIN).toString(`base64`);

const loginToTM = async () => {
  try {
    const ubi = await loginUbi(uplayLogin); // login to ubi, level 0
    const tmUbi = await loginTrackmaniaUbi(ubi.ticket); // login to trackmania, level 1
    const nadeo = await loginTrackmaniaNadeo(tmUbi.accessToken, `NadeoLiveServices`); // login to nadeo, level 2

    return {
      level0: ubi.ticket,
      level1: tmUbi.accessToken,
      level2: nadeo.accessToken
    };
  } catch (e) {
    console.log(`loginToTM error:`);
    console.log(e);
  }
};

const getPlayerName = async (credentials, playerId) => {
  try {
    const tmProfiles = await getProfiles(credentials.level1, [playerId]);

    if (tmProfiles.length === 0) {
      return playerId;
    }

    const ubiProfiles = await getProfilesById(credentials.level0, [tmProfiles[0].uid]);

    if (ubiProfiles.profiles.length === 0) {
      return playerId;
    }

    return ubiProfiles.profiles[0].nameOnPlatform;
  } catch (e) {
    console.log(`getPlayerName error:`);
    console.log(e);
  }
};

const getTMXInfo = async (mapUid) => {
  try {
    const tmxResponse = await axios.get(`https://trackmania.exchange/api/tracks/get_track_info/multi/${mapUid}`, {
      timeout: 10000 // timeout of 10s in case TMX is down
    });
    if (tmxResponse.data.length === 1) {
      // get tags
      const tmxTagsResponse = await axios.get(`https://trackmania.exchange/api/tags/gettags`);
      const resolvedTags = [];
      tmxResponse.data[0].Tags.split(`,`).forEach((tag) => {
        const matchingTag = tmxTagsResponse.data.find((tmxTag) => tmxTag.ID.toString() === tag);
        resolvedTags.push(matchingTag.Name);
      });

      // get available image
      let imageLink;
      if (tmxResponse.data[0].ImageCount > 0) {
        imageLink = `https://trackmania.exchange/maps/${tmxResponse.data[0].TrackID}/image/1`;
      }

      if (!imageLink && tmxResponse.data[0].HasThumbnail) {
        imageLink = `https://trackmania.exchange/maps/thumbnail/${tmxResponse.data[0].TrackID}`;
      }

      const tmxResult = { ...tmxResponse.data[0], Tags: resolvedTags };
      if (imageLink) {
        tmxResult.ImageLink = imageLink;
      }

      return tmxResult;
    } else {
      return;
    }
  } catch (e) {
    console.log(`getTMXInfo error:`);
    console.log(e);
  }
};

const getCurrentTOTD = async (credentials) => {
  try {
    const totds = await getTOTDs(credentials.level2);

    let currentTOTDMeta;
    for (let i = 0; i < totds.monthList[0].days.length; i++) {
      const totd = totds.monthList[0].days[i];

      if (totd.relativeStart < 0 && totd.relativeEnd > 0) {
        currentTOTDMeta = totd;
        break;
      }
    }

    const currentTOTDArray = await getMaps(credentials.level1, [currentTOTDMeta.mapUid]);
    const currentTOTD = currentTOTDArray[0];
    currentTOTD.seasonUid = currentTOTDMeta.seasonUid;

    currentTOTD.authorName = await getPlayerName(credentials, currentTOTD.author);

    const tmxInfo = await getTMXInfo(currentTOTD.mapUid);

    if (tmxInfo) {
      currentTOTD.tmxName = tmxInfo.Name;
      currentTOTD.tmxAuthor = tmxInfo.Username;
      currentTOTD.tmxTrackId = tmxInfo.TrackID;
      currentTOTD.tmxTags = tmxInfo.Tags;
      if (tmxInfo.ImageLink) {
        currentTOTD.thumbnailUrl = tmxInfo.ImageLink;
      }
    }

    currentTOTD.thumbnailUrl = await utils.downloadThumbnail(currentTOTD.thumbnailUrl, `thumbnail.jpg`);

    return currentTOTD;
  } catch (e) {
    console.log(`getCurrentTOTD error:`);
    console.log(e);
  }
};

const getTOTDLeaderboard = async (credentials, seasonUid, mapUid) => {
  try {
    const leaderboard = await getLeaderboardsAroundScore(credentials.level2, seasonUid, mapUid, 0);
    // if there aren't at least 50 records, return null
    if (!leaderboard.tops[0].top[50]) {
      console.log(`Can't find at least 50 records, stopping`);
      return null;
    }
    const records = leaderboard.tops[0].top.slice(1, 11);

    const extendedLeaderboard1 = await getLeaderboardsAroundScore(credentials.level2, seasonUid, mapUid, leaderboard.tops[0].top[50].score);
    const extendedLeaderboard2 = await getLeaderboardsAroundScore(credentials.level2, seasonUid, mapUid, extendedLeaderboard1.tops[0].top[50].score);

    const fullLeaderboard = [
      ...leaderboard.tops[0].top.slice(1),
      ...extendedLeaderboard1.tops[0].top.slice(1),
      ...extendedLeaderboard2.tops[0].top.slice(1)
    ];

    // try to find position 100 in the first 150
    let position100Number = 100;
    let position100 = fullLeaderboard.find((top) => top.position === position100Number);

    // sometimes the position 100 can't be found, then we try the next couple positions
    while (!position100 && position100Number < 106) {
      position100Number++;
      console.log(`Couldn't find top 100 immediately, trying ${position100Number} next`);
      position100 = fullLeaderboard.find((top) => top.position === position100Number);
    }

    records.push(position100);

    // if we can't find top 100 in the records, the leaderboard is still updating too fast - so we just stop and recommend waiting a bit
    // this checks if the last element is undefined
    if (!records[records.length - 1]) {
      console.log(`Can't find top 100, stopping`);
      return null;
    }

    for (let i = 0; i < records.length; i++) {
      records[i].playerName = await getPlayerName(credentials, records[i].accountId);

      if (i !== records.length - 1) {
        // adjust top 10 positions
        records[i].position = i + 1;
      } else {
        // set top 100 position (even if it's not exactly top 100)
        records[i].position = 100;
      }
    }

    return records;
    
  } catch (e) {
    console.log(`getTOTDLeaderboard error:`);
    console.log(e);
  }
};

module.exports = {
  loginToTM,
  getCurrentTOTD,
  getTOTDLeaderboard
};
