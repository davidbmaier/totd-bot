const url = require('url');
const redis = require('redis');
require('dotenv').config();

const redisURL = process.env.REDIS_URL;

const login = () => {
  return new Promise((resolve) => {
    const redisUrl = new url.URL(redisURL);
    const redisConn = redis.createClient(redisUrl.port, redisUrl.hostname);
    redisConn.auth(redisUrl.password);
    redisConn.on('ready', () => {
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

const addConfig = (redisClient, serverID, config) => {
  return new Promise(async (resolve, reject) => {
    redisClient.set(serverID, JSON.stringify(config), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const removeConfig = (redisClient, serverID) => {
  return new Promise(async (resolve, reject) => {
    redisClient.del(serverID, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const getConfig = (redisClient, key) => {
  return new Promise(async (resolve, reject) => {
    redisClient.get(key, (getErr, config) => {
      redisClient.quit();
      if (getErr) {
        reject(getErr);
      } else {
        try {
          const parsedConfig = JSON.parse(config);
          resolve(parsedConfig);
        } catch (configParseErr) {
          reject(configParseErr);
        }
      }
    });
  });
};

const getAllConfigs = (redisClient) => {
  return new Promise(async (resolve, reject) => {
    // get all entries
    redisClient.keys('*', async (keyErr, keys) => {
      if (keyErr) {
        reject(keyErr);
      } else {
        const configs = [];
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          configs.push(getConfig(redisClient, key));
        }
        resolve(await Promise.all(configs));
      }
    });
  });
};

module.exports = {
  login,
  logout,
  addConfig,
  removeConfig,
  getConfig,
  getAllConfigs
};
