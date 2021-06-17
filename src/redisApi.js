const url = require(`url`);
const redis = require(`redis`);
require(`dotenv`).config();

const constants = require(`./constants`);

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

const addRole = async (redisClient, serverID, role, region) => {
  let configs = await getConfigs(redisClient);
  return new Promise((resolve, reject) => {
    // set the config's roleName
    for (let i = 0; i < configs.length; i++) {
      if (configs[i].serverID === serverID) {
        // main/Europe region is stored in roleName, others in roleNameAmerica and roleNameAsia
        if (region && region !== constants.cupRegions.europe) {
          configs[i][`roleName${region}`] = role;
        } else {
          configs[i].roleName = role;
        }
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

const removeRole = async (redisClient, serverID, region) => {
  let configs = await getConfigs(redisClient);
  return new Promise((resolve, reject) => {
    // remove the config's roleName
    for (let i = 0; i < configs.length; i++) {
      if (configs[i].serverID === serverID){
        // main/Europe region is stored in roleName, others in roleNameAmerica and roleNameAsia
        if (region && region !== constants.cupRegions.europe) {
          delete configs[i][`roleName${region}`];
        } else {
          delete configs[i].roleName;
        }
        
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

const saveCurrentTOTD = async (redisClient, totd) => {
  return new Promise((resolve, reject) => {
    // save to redis
    redisClient.set(`totd`, JSON.stringify(totd), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const getCurrentTOTD = async (redisClient) => {
  return new Promise((resolve, reject) => {
    // save to redis
    redisClient.get(`totd`, (err, totd) => {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(totd) || undefined);
      }
    });
  });
};

const saveCurrentLeaderboard = async (redisClient, leaderboard) => {
  return new Promise((resolve, reject) => {
    // save to redis
    redisClient.set(`leaderboard`, JSON.stringify(leaderboard), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const getCurrentLeaderboard = async (redisClient) => {
  return new Promise((resolve, reject) => {
    // save to redis
    redisClient.get(`leaderboard`, (err, leaderboard) => {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(leaderboard) || undefined);
      }
    });
  });
};

const clearCurrentLeaderboard = async (redisClient) => {
  return new Promise((resolve, reject) => {
    // clear in redis
    redisClient.del(`leaderboard`, (err, leaderboard) => {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(leaderboard) || undefined);
      }
    });
  });
};

const getLastTOTDVerdict = async (redisClient) => {
  return new Promise((resolve, reject) => {
    redisClient.get(`verdict`, async (err, verdict) => {
      if (err) {
        reject(err);
      } else {
        if (verdict) {
          try {
            const parsedVerdict = JSON.parse(verdict);
            resolve(parsedVerdict);
          } catch (error) {
            reject(`Unable to parse verdict JSON`);
          }
        } else {
          resolve();
        }
      }
    });
  });
};

const saveLastTOTDVerdict = async (redisClient, verdict) => {
  return new Promise((resolve, reject) => {
    redisClient.set(`verdict`, JSON.stringify(verdict), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const getTOTDRatings = async (redisClient) => {
  return new Promise((resolve, reject) => {
    redisClient.get(`ratings`, async (err, ratings) => {
      if (err) {
        reject(err);
      } else {
        if (ratings) {
          try {
            const parsedRatings = JSON.parse(ratings);
            resolve(parsedRatings);
          } catch (error) {
            reject(`Unable to parse rating JSON`);
          }
        } else {
          const clearedRatings = await clearTOTDRatings(redisClient);
          resolve(clearedRatings);
        }
      }
    });
  });
};

const clearTOTDRatings = async (redisClient) => {
  return new Promise((resolve, reject) => {
    const baseRating = {};
    for (let i = 0; i < constants.ratingEmojis.length; i++) {
      baseRating[constants.ratingEmojis[i]] = 0;
    }

    redisClient.set(`ratings`, JSON.stringify(baseRating), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(baseRating);
      }
    });
  });
};

const updateTOTDRatings = async (redisClient, emojiName, add) => {
  return new Promise((resolve, reject) => {
    redisClient.get(`ratings`, async (getErr, rating) => {
      if (getErr) {
        reject(getErr);
      } else {
        if (!rating) {
          rating = await clearTOTDRatings(redisClient);
        } else {
          rating = JSON.parse(rating);
        }

        if (add) {
          rating[emojiName] += 1;
        } else {
          rating[emojiName] -= 1;
          // check that it can't go below 0
          if (rating[emojiName] < 0) {
            rating[emojiName] = 0;
          }
        }
        
        redisClient.set(`ratings`, JSON.stringify(rating), (setErr) => {
          if (setErr) {
            reject(setErr);
          } else {
            resolve(rating);
          }
        });
      }
    });
  });
};

const getBingoBoard = async (redisClient, lastWeek) => {
  return new Promise((resolve, reject) => {
    let bingoEntry = `bingo`;
    if (lastWeek) {
      bingoEntry = `lastBingo`;
    }
    redisClient.get(bingoEntry, (err, board) => {
      if (err) {
        reject(err);
      } else {
        if (board) {
          resolve(JSON.parse(board));
        } else {
          resolve();
        }
      }
    });
  });
};

const saveBingoBoard = async (redisClient, board, lastWeek) => {
  return new Promise((resolve, reject) => {
    let bingoEntry = `bingo`;
    if (lastWeek) {
      bingoEntry = `lastBingo`;
    }
    redisClient.set(bingoEntry, JSON.stringify(board), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(board);
      }
    });
  });
};

module.exports = {
  login,
  logout,
  addConfig,
  removeConfig,
  addRole,
  removeRole,
  getAllConfigs,
  saveCurrentTOTD,
  saveCurrentLeaderboard,
  getCurrentTOTD,
  getCurrentLeaderboard,
  clearCurrentLeaderboard,
  getLastTOTDVerdict,
  saveLastTOTDVerdict,
  getTOTDRatings,
  clearTOTDRatings,
  updateTOTDRatings,
  getBingoBoard,
  saveBingoBoard
};
