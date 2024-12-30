const axios = require(`axios`);
const { DateTime } = require(`luxon`);

const userLogin = process.env.USER_LOGIN;
const oauthID = process.env.OAUTH_ID;
const oauthSecret = process.env.OAUTH_SECRET;

let coreToken;
let liveToken;
let oauthToken;

let lastRequestSent;

const sendRequest = async ({url, token, method = `get`, body = {}, headersOverride}) => {
  let authOverride;

  let tokenValue = coreToken;
  if (token === `live`) {
    tokenValue = liveToken;
  } else if (token === `oauth`) {
    authOverride = `Bearer ${oauthToken}`;
  }

  let headers = {
    'Content-Type': `application/json`,
    'User-Agent': `TOTD Discord Bot - tooInfinite`,
    'Authorization': authOverride || `nadeo_v1 t=${tokenValue}`,
    ...headersOverride
  };

  try {
    // make sure only two requests get sent per second max
    if (lastRequestSent) {
      const timeDiff = DateTime.now().diff(lastRequestSent, `seconds`);
      if (timeDiff.toObject().seconds < 1) {
        //console.log(`--- Delaying request for rate limit`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    console.log(`--- Sending ${method} request to "${url}"`);
    lastRequestSent = DateTime.now();
    const response = await axios({
      url: url,
      method: method,
      data: body,
      headers: headers
    });

    return response.data;
  } catch (error) {
    if (error.response?.status === 401) {
      console.log(`--- 401: Refresh tokens and call the endpoint again`);
      if (token === `oauth`) {
        await loginOAuth();
      } else {
        await login();
      }
      return await sendRequest({url, token, method, body, headersOverride});
    } else {
      console.error(error);
      throw error;
    }
  }
};

const login = async () => {
  const ticketResponse = await sendRequest({
    url: `https://public-ubiservices.ubi.com/v3/profiles/sessions`,
    method: `post`,
    headersOverride: {
      'Ubi-AppId': `86263886-327a-4328-ac69-527f0d20a237`,
      Authorization: `Basic ${Buffer.from(userLogin).toString(`base64`)}`
    }
  });
  const ticket = ticketResponse.ticket;

  const coreTokenResponse = await sendRequest({
    url: `https://prod.trackmania.core.nadeo.online/v2/authentication/token/ubiservices`,
    method: `post`,
    headersOverride: {
      Authorization: `ubi_v1 t=${ticket}`
    },
    body: {audience: `NadeoServices`}
  });
  coreToken = coreTokenResponse.accessToken;

  const liveTokenResponse = await sendRequest({
    url: `https://prod.trackmania.core.nadeo.online/v2/authentication/token/ubiservices`,
    method: `post`,
    headersOverride: {
      Authorization: `ubi_v1 t=${ticket}`
    },
    body: {audience: `NadeoLiveServices`}
  });
  liveToken = liveTokenResponse.accessToken;

  console.log(`Game API login successful`);
};

const loginOAuth = async () => {
  const oauthTokenResponse = await sendRequest({
    url: `https://api.trackmania.com/api/access_token`,
    method: `post`,
    headersOverride: {
      'Content-Type': `application/x-www-form-urlencoded`,
      Authorization: `` // no auth header for login
    },
    body: `grant_type=client_credentials&client_id=${oauthID}&client_secret=${oauthSecret}`
  });
  oauthToken = oauthTokenResponse.access_token;
  console.log(`OAuth login successful`);
};

const getPlayerNames = async (accountIDs) => {
  // assemble accountIDs in correct format
  const accountIDList = accountIDs.map((accountID) => `accountId[]=${accountID}`).join(`&`);

  const accounts = await sendRequest({
    url: `https://api.trackmania.com/api/display-names/?${accountIDList}`,
    token: `oauth`
  });

  // reorganize account-name mappings into array of {accountId, displayName} for compatibility
  const names = Object.entries(accounts).map(([accountID, accountName]) => ({accountId: accountID, displayName: accountName}));
  return names;
};

const getPlayerName = async (accountID) => {
  const account = await getPlayerNames([accountID]);
  return account[0].displayName;
};

const getMaps = async (mapUids) => {
  const maps = await sendRequest({
    url: `https://prod.trackmania.core.nadeo.online/maps/?mapUidList=${mapUids.join(`,`)}`,
    token: `core`
  });
  return maps;
};

const getTMXInfo = async (mapUid) => {
  try {
    const tmxResponse = await axios.get(`https://trackmania.exchange/api/maps/?uid=${mapUid}&fields=Tags,Name,HasImages,MapId,UpdatedAt`, {
      timeout: 5000 // timeout of 5s in case TMX is down
    });
    if (tmxResponse.data.Results.length === 1) {
      const tmxResult = { ...tmxResponse.data.Results[0] };

      // get available image
      let imageLink;
      if (tmxResult.HasImages) {
        imageLink = `https://trackmania.exchange/mapimage/${tmxResult.MapId}/1`;
      }

      if (!imageLink && tmxResult.HasThumbnail) {
        imageLink = `https://trackmania.exchange/mapimage/${tmxResult.MapId}/0`;
      }
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

const getCurrentTOTD = async () => {
  try {
    const totds = await sendRequest({
      url: `https://live-services.trackmania.nadeo.live/api/token/campaign/month?length=5&offset=0&royal=false`,
      token: `live`
    });

    let currentTOTDMeta;
    for (let i = 0; i < totds.monthList[0].days.length; i++) {
      const totd = totds.monthList[0].days[i];

      if (totd.relativeStart < 0 && totd.relativeEnd > 0) {
        currentTOTDMeta = totd;
        break;
      }
    }

    if (!currentTOTDMeta) {
      console.error(JSON.stringify(totds));
      throw `Couldn't find current TOTD, see above for retrieved maps`;
    }

    const currentTOTDArray = await getMaps([currentTOTDMeta.mapUid]);
    const currentTOTD = currentTOTDArray[0];
    currentTOTD.seasonUid = currentTOTDMeta.seasonUid;

    currentTOTD.authorName = await getPlayerName([currentTOTD.author]);

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
      currentTOTD.tmxTrackId = tmxInfo.MapId;
      currentTOTD.tmxTags = tmxInfo.Tags.map((tag) => tag.Name);
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

const getLeaderboardPosition = async (seasonUid, mapUid, position) => {
  const leaderboardPositionInfo = await sendRequest({
    url: `https://live-services.trackmania.nadeo.live/api/token/leaderboard/group/${seasonUid}/map/${mapUid}/top?length=1&onlyWorld=true&offset=${position - 1}`,
    token: `live`
  });

  const record = leaderboardPositionInfo?.tops[0]?.top[0];
  if (record) {
    record.playerName = await getPlayerName([record.accountId]);
    record.position = position;
  }

  return record;
};

const getTOTDLeaderboard = async (seasonUid, mapUid) => {
  try {
    const leaderboardInfo = await sendRequest({
      url: `https://live-services.trackmania.nadeo.live/api/token/leaderboard/group/${seasonUid}/map/${mapUid}/top?length=10&onlyWorld=true`,
      token: `live`
    });

    const records = leaderboardInfo.tops[0].top;

    console.log(`Fetching player names...`);
    const playerNames = await getPlayerNames(records.map((record) => record.accountId));

    for (let i = 0; i < records.length; i++) {
      records[i].playerName = playerNames.find((player) => player.accountId === records[i].accountId).displayName;
      records[i].position = i + 1;
    }

    const top100 = await getLeaderboardPosition(seasonUid, mapUid, 100);
    const top1000 = await getLeaderboardPosition(seasonUid, mapUid, 1000);
    const top10000 = await getLeaderboardPosition(seasonUid, mapUid, 10000);

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
  } catch (error) {
    console.log(`getTOTDLeaderboard error:`);
    console.log(error);
  }
};


module.exports = {
  login,
  loginOAuth,
  getCurrentTOTD,
  getTOTDLeaderboard
};
