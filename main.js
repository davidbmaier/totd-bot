const Discord = require('discord.js');
const client = new Discord.Client();
const cron = require('cron').CronJob;

const tmAPI = require('./tmApi');
const format = require('./format');

require('dotenv').config();

const discordToken = process.env.DISCORD_TOKEN;
const deployMode = process.env.DEPLOY_MODE;

const displayCurrentTOTD = async (channel) => {
  console.log(`Sending current TOTD to ${channel.name} in ${channel.guild.name}`);

  const credentials = await tmAPI.loginToTM();
  const totd = await tmAPI.getCurrentTOTD(credentials);
  const message = await channel.send(format.formatTOTDMessage(totd));
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
    await message.react(emoji);
  });
};

// display the current totd every day at 19:00:30
new cron(
  '30 00 19 * * *',
  async () => {
    // TODO: get the channels this should post to
    const channel = await client.channels.fetch('763052026028359690');
    displayCurrentTOTD(channel);
  },
  null,
  true,
  'Europe/Berlin'
);

client.on('ready', () => {
  console.log(`Ready as ${client.user.tag}!`);
});

// add the prefix 'dev' to each command when not in prod mode
// (so you can test it without triggering the live bot as well - assuming you have both running)
const addDevPrefix = (command) => {
  if (deployMode && deployMode !== 'prod') {
    // this assumes every command starts with '!'
    return `!dev${command.substr(1)}`;
  } else {
    return command;
  }
};

client.on('message', async (msg) => {
  if (msg.content === addDevPrefix(`!totd`)) {
    displayCurrentTOTD(msg.channel);
  } else if (msg.content === '!debug') {
    console.log('Generic debug message :)');
  }
  // TODO: handle config messages
});

client.login(discordToken);
