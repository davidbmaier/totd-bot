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
    redisClient.get(`totd`, (err, totd) => {
      if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(totd) || undefined);
      }
    });
  });
};

const savePreviousTOTD = async (redisClient, totd) => {
  return new Promise((resolve, reject) => {
    // save to redis
    redisClient.set(`totdYesterday`, JSON.stringify(totd), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const getPreviousTOTD = async (redisClient) => {
  return new Promise((resolve, reject) => {
    redisClient.get(`totdYesterday`, (err, totd) => {
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

const getRatingRankings = async (redisClient, type) => {
  return new Promise((resolve, reject) => {
    const key = `${type}Ratings`;
    redisClient.get(key, (err, ratings) => {
      if (err) {
        reject(err);
      } else {
        try {
            const parsedRatings = JSON.parse(ratings);
            resolve(parsedRatings);
          } catch (error) {
            reject(`Unable to parse monthly ratings JSON`);
          }
      }
    });
  });
};

const saveRatingRankings = async (redisClient, type, ratings) => {
  return new Promise((resolve, reject) => {
    const key = `${type}Ratings`;
    redisClient.set(key, JSON.stringify(ratings), (err) => {
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

const clearIndividualRatings = async (redisClient) => {
  return new Promise((resolve, reject) => {
    redisClient.set(`individualRatings`, JSON.stringify([]), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve([]);
      }
    });
  });
};

const getIndividualRatings = async (redisClient) => {
  return new Promise((resolve, reject) => {
    redisClient.get(`individualRatings`, async (err, individualRatings) => {
      if (err) {
        reject(err);
      } else {
        if (individualRatings) {
          try {
            const parsedRatings = JSON.parse(individualRatings);
            resolve(parsedRatings);
          } catch (error) {
            reject(`Unable to parse individual ratings JSON`);
          }
        } else {
          return await clearIndividualRatings(redisClient);
        }
      }
    });
  });
};

// return value determines if the update was valid
const updateIndividualRatings = async (redisClient, emojiName, add, user) => {
  return new Promise((resolve, reject) => {
    redisClient.get(`individualRatings`, async (getErr, individualRatings) => {
      if (getErr) {
        reject(getErr);
      } else {
        if (!individualRatings) {
          individualRatings = await clearIndividualRatings(redisClient);
        } else {
          try {
            individualRatings = JSON.parse(individualRatings);
          } catch (error) {
            return reject(`Unable to parse individual ratings JSON`);
          }
        }

        // check if this user has already voted with this emoji
        const existingRating = individualRatings.find((rating) => rating.user === user && rating.vote === emojiName);

        if (existingRating && add) {
          // can't add the same vote again
          return resolve(false);
        } else if (existingRating && !add) {
          // removing the existing rating
          const index = individualRatings.indexOf(existingRating);
          individualRatings.splice(index, 1);
        } else if (!existingRating && add) {
          // adding a new rating
          individualRatings.push({
            user,
            vote: emojiName,
          });
        } else if (!existingRating && !add) {
          // can't remove a rating that doesn't exist, no-op
        }

        redisClient.set(`individualRatings`, JSON.stringify(individualRatings), (setErr) => {
          if (setErr) {
            reject(setErr);
          } else {
            resolve(true);
          }
        });
      }
    });
  });
};

const getBingoBoard = async (redisClient, serverID, lastWeek) => {
  return new Promise((resolve, reject) => {
    let bingoEntry = `bingo`;
    if (lastWeek) {
      bingoEntry = `lastBingo`;
    }
    redisClient.get(bingoEntry, (err, boards) => {
      if (err) {
        reject(err);
      } else {
        if (boards) {
          const parsedBoards = JSON.parse(boards);
          resolve(parsedBoards[serverID]);
        } else {
          resolve();
        }
      }
    });
  });
};

const getAllBingoBoards = async (redisClient) => {
  return new Promise((resolve, reject) => {
    redisClient.get(`bingo`, (err, boards) => {
      if (err) {
        reject(err);
      } else {
        if (boards) {
          resolve(JSON.parse(boards));
        } else {
          resolve();
        }
      }
    });
  });
};

const saveBingoBoard = async (redisClient, board, serverID) => {
  return new Promise((resolve, reject) => {
    redisClient.get(`bingo`, (getErr, boards) => {
      if (getErr) {
        return reject(getErr);
      }
      const parsedBoards = JSON.parse(boards);
      parsedBoards[serverID] = board;
      redisClient.set(`bingo`, JSON.stringify(parsedBoards), (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(board);
        }
      });
    });
  });
};

const resetBingoBoards = async (redisClient) => {
  return new Promise((resolve, reject) => {
    redisClient.set(`bingo`, JSON.stringify({}), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const archiveBingoBoards = async (redisClient, boards) => {
  return new Promise((resolve, reject) => {
    redisClient.set(`lastBingo`, JSON.stringify(boards), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(boards);
      }
    });
  });
};

const getAllStoredTOTDs = async (redisClient) => {
  return new Promise((resolve, reject) => {
    redisClient.get(`totds`, (err, totds) => {
      if (err) {
        reject(err);
      } else {
        if (totds) {
          resolve(JSON.parse(totds));
        } else {
          resolve();
        }
      }
    });
  });
};

const storeTOTDs = async (redisClient, totds) => {
  return new Promise((resolve, reject) => {
    redisClient.set(`totds`, JSON.stringify(totds), (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(totds);
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
  getRatingRankings,
  saveRatingRankings,
  getTOTDRatings,
  clearTOTDRatings,
  updateTOTDRatings,
  clearIndividualRatings,
  getIndividualRatings,
  updateIndividualRatings,
  getBingoBoard,
  saveBingoBoard,
  resetBingoBoards,
  getAllBingoBoards,
  archiveBingoBoards,
  savePreviousTOTD,
  getPreviousTOTD,
  getAllStoredTOTDs,
  storeTOTDs
};
