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
    const ubi = await loginUbi(uplayLogin); // login to ubi
    const tmUbi = await loginTrackmaniaUbi(ubi.ticket); // login to trackmania
    const nadeo = await loginTrackmaniaNadeo(tmUbi.accessToken, `NadeoLiveServices`); // login to nadeo

    return {
      ubiTicket: ubi.ticket,
      tmToken: tmUbi.accessToken,
      nadeoToken: nadeo.accessToken
    };
  } catch (e) {
    console.log(`loginToTM error:`);
    console.log(e);
  }
};

const getNadeoHeaders = (credentials) => {
  return {
    'Content-Type': `application/json`,
    'Ubi-AppId': `86263886-327a-4328-ac69-527f0d20a237`,
    'Ubi-RequestedPlatformType': `uplay`,
    'Authorization': `nadeo_v1 t=${credentials.nadeoToken}`
  };
};

const getPlayerName = async (credentials, playerId) => {
  try {
    const tmProfiles = await getProfiles(credentials.tmToken, [playerId]);

    if (tmProfiles.length === 0) {
      return playerId;
    }

    const ubiProfiles = await getProfilesById(credentials.ubiTicket, [tmProfiles[0].uid]);

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
    const totds = await getTOTDs(credentials.nadeoToken);

    let currentTOTDMeta;
    for (let i = 0; i < totds.monthList[0].days.length; i++) {
      const totd = totds.monthList[0].days[i];

      if (totd.relativeStart < 0 && totd.relativeEnd > 0) {
        currentTOTDMeta = totd;
        break;
      }
    }

    const currentTOTDArray = await getMaps(credentials.tmToken, [currentTOTDMeta.mapUid]);
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

const getLeaderboardPosition = async (credentials, seasonUid, mapUid, position) => {
  try {
    const route = `https://live-services.trackmania.nadeo.live/api/token/leaderboard/group/${seasonUid}/map/${mapUid}/top?length=1&onlyWorld=true&offset=${position - 1}`;

    const response = await axios.get(route, {
      headers: getNadeoHeaders(credentials)
    });

    const record = response?.data?.tops[0]?.top[0];

    if (record) {
      record.playerName = await getPlayerName(credentials, record.accountId);
      record.position = position;
    }

    return record;
  } catch (e) {
    console.log(`getLeaderboardPosition error:`);
    console.log(e);
  }
};

const getTOTDLeaderboard = async (credentials, seasonUid, mapUid) => {
  try {
    const headers = getNadeoHeaders(credentials);

    const baseRoute = `https://live-services.trackmania.nadeo.live/api/token/leaderboard/group/${seasonUid}/map/${mapUid}/top?length=10&onlyWorld=true`;
    const baseResponse = await axios.get(baseRoute, {
      headers,
    });

    const leaderboard = baseResponse?.data;
    const records = leaderboard.tops[0].top;

    for (let i = 0; i < records.length; i++) {
      records[i].playerName = await getPlayerName(credentials, records[i].accountId);
      records[i].position = i + 1;
    }

    const top100 = await getLeaderboardPosition(credentials, seasonUid, mapUid, 100);
    const top1000 = await getLeaderboardPosition(credentials, seasonUid, mapUid, 1000);
    const top10000 = await getLeaderboardPosition(credentials, seasonUid, mapUid, 10000);

    if (top100) {
      records.push(top100);
    }
    if (top1000) {
      records.push(top1000);
    }
    if (top10000) {
      records.push(top10000);
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
