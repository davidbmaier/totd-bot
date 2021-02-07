const Discord = require('discord.js');
const client = new Discord.Client();

const tmAPI = require('./tmApi');
const format = require('./format');

require('dotenv').config();

const discordToken = process.env.DISCORD_TOKEN;

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', async (msg) => {
  if (msg.content === '!totd') {
    const credentials = await tmAPI.loginToTM();
    const totd = await tmAPI.getCurrentTOTD(credentials);
    const message = await msg.channel.send(format.formatTOTDMessage(totd));
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
  }
});

client.login(discordToken);
