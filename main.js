const Discord = require('discord.js');
const client = new Discord.Client();
const cron = require('cron').CronJob;
require('dotenv').config();

const tmAPI = require('./src/tmApi');
const format = require('./src/format');
const redisAPI = require('./src/redisApi');

const discordToken = process.env.DISCORD_TOKEN;
const deployMode = process.env.DEPLOY_MODE;
const adminTag = process.env.ADMIN_TAG;

const sendErrorMessage = (channel) => {
  channel.send("Oops, something went wrong here - please talk to my dev and let him know that didn't work.");
};

const getTOTDMessage = async () => {
  const credentials = await tmAPI.loginToTM();
  const totd = await tmAPI.getCurrentTOTD(credentials);
  return format.formatTOTDMessage(totd);
};

const sendTOTDMessage = async (channel, message) => {
  console.log(`Sending current TOTD to #${channel.name} in ${channel.guild.name}`);

  const discordMessage = await channel.send(message);
  // add rating emojis
  const emojis = [
    client.emojis.resolve(`807983766239838208`),
    client.emojis.resolve(`807983738603962368`),
    client.emojis.resolve(`807983713698316308`),
    client.emojis.resolve(`807983669330706482`),
    client.emojis.resolve(`807983625001107497`),
    client.emojis.resolve(`807983052046598165`)
  ];
  emojis.forEach(async (emoji) => {
    await discordMessage.react(emoji);
  });
};

const distributeTOTDMessages = async () => {
  const message = await getTOTDMessage();

  const redisClient = await redisAPI.login();
  const configs = await redisAPI.getAllConfigs(redisClient);
  redisAPI.logout(redisClient);

  configs.forEach(async (config) => {
    try {
      const channel = await client.channels.fetch(config.channelID);
      sendTOTDMessage(channel, message);
    } catch (error) {
      if (error.message === 'Missing Access') {
        console.log("Can't access server, bot was probably kicked.");
      } else {
        console.error(error);
      }
    }
  });
};

// display the current totd every day at 19:00:30
new cron(
  '30 00 19 * * *',
  async () => {
    distributeTOTDMessages();
  },
  null,
  true,
  'Europe/Berlin'
);

client.on('ready', () => {
  console.log(`Ready as ${client.user.tag}!`);
});

// add the prefix 'dev' to each command when not in prod mode
// (so you can test it without triggering the live bot as well - assuming you have both running with the same ID)
const addDevPrefix = (command) => {
  if (deployMode && deployMode !== 'prod') {
    // this assumes every command starts with '!'
    return `!dev${command.substr(1)}`;
  } else {
    return command;
  }
};

client.on('message', async (msg) => {
  if (msg.guild && msg.content.startsWith(addDevPrefix('!totd'))) {
    console.log(`Received message: ${msg.content}`);
    switch (msg.content) {
      case addDevPrefix('!totd today'):
        try {
          sendTOTDMessage(msg.channel, await getTOTDMessage());
        } catch (error) {
          sendErrorMessage(msg.channel);
        }
        break;
      case addDevPrefix('!totd enable'):
        if (msg.member.hasPermission('ADMINISTRATOR') || msg.author.tag === adminTag) {
          try {
            const redisClient = await redisAPI.login();
            await redisAPI.addConfig(redisClient, msg.guild.id, {
              channelID: msg.channel.id
            });
            redisAPI.logout(redisClient);
            msg.channel.send("You got it, I'll post the TOTD every day just after it comes out.");
          } catch (error) {
            sendErrorMessage(msg.channel);
          }
        } else {
          msg.channel.send("You don't have the `ADMINISTRATOR` permission, sorry.");
        }
        break;
      case addDevPrefix(`!totd disable`):
        if (msg.member.hasPermission('ADMINISTRATOR') || msg.author.tag === adminTag) {
          try {
            const redisClient = await redisAPI.login();
            await redisAPI.removeConfig(redisClient, msg.guild.id);
            redisAPI.logout(redisClient);
            msg.channel.send("Alright, I'll stop posting from now on.");
          } catch (error) {
            sendErrorMessage(msg.channel);
          }
          break;
        } else {
          msg.channel.send("You don't have the `ADMINISTRATOR` permissions, sorry.");
        }
      case addDevPrefix('!totd debug'):
        if (msg.author.tag === adminTag) {
          try {
            distributeTOTDMessages();
          } catch (error) {
            sendErrorMessage(msg.channel);
          }
        }
        break;
      case addDevPrefix('!totd help'):
        const message = `\`${addDevPrefix('!totd today')}\`  -  Prints the current TOTD information.\n \
          \`${addDevPrefix('!totd enable')}\`  -  Enables daily TOTD posts in this channel (admin only).\n \
          \`${addDevPrefix('!totd disable')}\`  -  Disables the daily posts again (admin only).\n \
          \`${addDevPrefix('!totd help')}\`  -  You're looking at it.`;
        const formattedMessage = format.formatHelpMessage(message);
        msg.channel.send(formattedMessage);
        break;
      default:
        msg.channel.send(
          `I don't know what to do, you might want to check \`${addDevPrefix('!totd help')}\` to see what I can understand.`
        );
        break;
    }
  }
});

client.on('guildCreate', (guild) => {
  console.log(`Joined new server: ${guild.name}`);
});

client.on('guildDelete', (guild) => {
  console.log(`Left server: ${guild.name}`);
});

client.login(discordToken);
