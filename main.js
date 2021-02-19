const Discord = require(`discord.js`);
const client = new Discord.Client();
const cron = require(`cron`).CronJob;
require(`dotenv`).config();

const discordAPI = require(`./src/discordAPI`);
const commands = require(`./src/commands`);
const utils = require(`./src/utils`);

const discordToken = process.env.DISCORD_TOKEN;

// display the current totd every day at 19:00:30
new cron(
  `30 00 19 * * *`,
  async () => {
    discordAPI.distributeTOTDMessages(client);
  },
  null,
  true,
  `Europe/Berlin`
);

client.on(`ready`, async () => {
  console.log(`Ready as ${client.user.tag}!`);
  // refresh TOTD to make sure there is a thumbnail in the images for cached messages
  await discordAPI.getTOTDMessage(true);
});

client.on(`message`, async (msg) => {
  if (msg.guild && msg.content.startsWith(utils.addDevPrefix(`!totd`))) {
    console.log(`Received message: ${msg.content} (${msg.channel.name} in ${msg.guild.name})`);

    let matchedCommand;
    for (let i = 0; i < commands.length; i++) {
      if (msg.content.startsWith(commands[i].command)) {
        matchedCommand = commands[i];
        break;
      }
    }

    if (matchedCommand) {
      await matchedCommand.action(msg, client);
    } else {
      msg.channel.send(
        `I don't know what to do, you might want to check \`${utils.addDevPrefix(`!totd help`)}\` to see what I can understand.`
      );
    }
  }
});

client.on(`guildCreate`, (guild) => {
  console.log(`Joined new server: ${guild.name}`);
});

client.on(`guildDelete`, (guild) => {
  console.log(`Left server: ${guild.name}`);
});

client.login(discordToken);
