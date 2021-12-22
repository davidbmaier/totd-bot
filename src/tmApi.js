const {
  loginUbi,
  loginTrackmaniaUbi,
  loginTrackmaniaNadeo,
  getMaps,
  getTOTDs,
  getProfiles,
  getProfilesById,
} = require(`trackmania-api-node`);
require(`dotenv`).config();
const axios = require(`axios`);

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
      timeout: 5000 // timeout of 5s in case TMX is down
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

    // get the current hour in Paris
    const currentHour = new Date().toLocaleString(`en-US`, {hour: `2-digit`, hour12: false, timeZone: `Europe/Paris`});

    let totdDate;
    if (currentHour < 19) {
      // if it's yesterday's TOTD we need to know what yesterday's date was in Paris
      totdDate = new Date();
      totdDate.setHours(totdDate.getHours() - 19);
    } else {
      // use the current date in Paris
      totdDate = new Date();
    }

    currentTOTD.day = totdDate.toLocaleString(`en-US`, {day: `numeric`, timeZone: `Europe/Paris`});
    currentTOTD.month = totdDate.toLocaleString(`en-US`, {month: `long`, timeZone: `Europe/Paris`});
    currentTOTD.year = totdDate.toLocaleString(`en-US`, {year: `numeric`, timeZone: `Europe/Paris`});

    const tmxInfo = await getTMXInfo(currentTOTD.mapUid);

    if (tmxInfo) {
      currentTOTD.tmxName = tmxInfo.Name;
      currentTOTD.tmxAuthor = tmxInfo.Username;
      currentTOTD.tmxTrackId = tmxInfo.TrackID;
      currentTOTD.tmxTags = tmxInfo.Tags;
      currentTOTD.tmxTimestamp = tmxInfo.UpdatedAt;
      if (!currentTOTD.tmxTimestamp.includes(`+`)) {
        // if there's no timezone information, assume UTC
        currentTOTD.tmxTimestamp = `${currentTOTD.tmxTimestamp}+00:00`;
      }
      if (tmxInfo.ImageLink) {
        currentTOTD.thumbnailUrl = tmxInfo.ImageLink;
      }
    }

    return currentTOTD;
  } catch (e) {
    console.log(`getCurrentTOTD error:`);
    console.log(e);
  }
};

const getTOTDLeaderboard = async (credentials, seasonUid, mapUid) => {
  try {
    const headers = {
      'Content-Type': `application/json`,
      'Ubi-AppId': `86263886-327a-4328-ac69-527f0d20a237`,
      'Ubi-RequestedPlatformType': `uplay`,
      'Authorization': `nadeo_v1 t=${credentials.level2}`
    };

    const route = `https://live-services.trackmania.nadeo.live/api/token/leaderboard/group/${seasonUid}/map/${mapUid}/top?length=50&onlyWorld=true`;
    const response = await axios.get(route, {
      headers,
    });

    const leaderboard = response?.data;
    const records = leaderboard.tops[0].top.slice(0, 10); // get top 10 records

    const top50 = leaderboard.tops[0].top.find((top) => top.position === 50);
    if (top50) {
      records.push(top50);
    }

    for (let i = 0; i < records.length; i++) {
      records[i].playerName = await getPlayerName(credentials, records[i].accountId);

      records[i].position = i + 1;

      // if we have 50 records, make sure the last position value is correct
      if (top50 && i === records.length - 1) {
        records[i].position = `50`;
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
