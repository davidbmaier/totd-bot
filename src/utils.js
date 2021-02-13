require(`dotenv`).config();

const deployMode = process.env.DEPLOY_MODE;

// add the prefix 'dev' to each command when not in prod mode
// (so you can test it without triggering the live bot as well - assuming you have both running with the same ID)
const addDevPrefix = (command) => {
  if (deployMode && deployMode !== `prod`) {
    // this assumes every command starts with '!'
    return `!dev${command.substr(1)}`;
  } else {
    return command;
  }
};

module.exports = {
  addDevPrefix
};
