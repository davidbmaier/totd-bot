const url = require(`url`);
const redis = require(`redis`);
require(`dotenv`).config();

const redisURL = process.env.REDIS_URL;

const login = () => {
  return new Promise((resolve) => {
    const parsedRedisURL = new url.URL(redisURL);
    const redisConn = redis.createClient(parsedRedisURL.port, parsedRedisURL.hostname);
    if (parsedRedisURL.password) {
      redisConn.auth(parsedRedisURL.password);
    }
    redisConn.on(`ready`, () => {
      resolve(redisConn);
    });
  });
};

const logout = (redisClient) => {
  return new Promise((resolve) => {
    redisClient.quit();
    resolve();
  });
};

const getConfigs = (redisClient) => {
  return new Promise((resolve, reject) => {
    redisClient.get(`serverConfigs`, (err, configs) => {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(configs) || []);
      }
    });
  });
};

const addConfig = async (redisClient, serverID, channelID) => {
  let configs = await getConfigs(redisClient);
  return new Promise((resolve, reject) => {
    // remove duplicate
    for (let i = 0; i < configs.length; i++) {
      if (configs[i].serverID === serverID){
        configs.splice(i, 1);
        break;
      }
    }
    // add new config
    configs.push({serverID: serverID, channelID: channelID});
    // save to redis
    redisClient.set(`serverConfigs`, JSON.stringify(configs), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const removeConfig = async (redisClient, serverID) => {
  let configs = await getConfigs(redisClient);
  return new Promise((resolve, reject) => {
    // remove config with serverID
    for (let i = 0; i < configs.length; i++) {
      if (configs[i].serverID === serverID){
        configs.splice(i, 1);
        break;
      }
    }
    // save to redis
    redisClient.set(`serverConfigs`, JSON.stringify(configs), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const getAllConfigs = async (redisClient) => {
  const configs = await getConfigs(redisClient);
  return Promise.resolve(configs);
};

module.exports = {
  login,
  logout,
  addConfig,
  removeConfig,
  getAllConfigs
};
