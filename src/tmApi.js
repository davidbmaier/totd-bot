const {
  loginUbi,
  loginTrackmaniaUbi,
  loginTrackmaniaNadeo,
  getMaps,
  getTOTDs,
  getProfiles,
  getProfilesById
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

const getAuthorName = async (credentials, map) => {
  try {
    const tmProfiles = await getProfiles(credentials.level1, [map.author]);

    if (tmProfiles.length === 0) {
      return map.author;
    }

    const ubiProfiles = await getProfilesById(credentials.level0, [tmProfiles[0].uid]);

    if (ubiProfiles.profiles.length === 0) {
      return map.author;
    }

    return ubiProfiles.profiles[0].nameOnPlatform;
  } catch (e) {
    console.log(`getAuthorName error:`);
    console.log(e);
  }
};

const getTMXInfo = async (mapUid) => {
  try {
    const tmxResponse = await axios.get(`https://trackmania.exchange/api/tracks/get_track_info/multi/${mapUid}`);
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
        // check that it's a valid image file (sometimes it might be a file without an ending, resulting in a raw octet stream)
        // Discord can't handle those, so we switch back to the thumbnail
        const imageResponse = await axios.get(imageLink);
        if (imageResponse.headers[`content-type`] === `application/octet-stream`) {
          imageLink = undefined;
        }
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

    currentTOTD.authorName = await getAuthorName(credentials, currentTOTD);

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

    return currentTOTD;
  } catch (e) {
    console.log(`getCurrentTOTD error:`);
    console.log(e);
  }
};

module.exports = {
  loginToTM,
  getCurrentTOTD
};
