# TOTD Discord Bot

This is a Discord bot for displaying the daily [Trackmania](https://www.trackmania.com/) Track of the Day (and a few other things).

**Disclaimer:** This bot uses undocumented APIs (and libraries based on them), so it may break at any time - potentially indefinitely if Nadeo/Ubisoft decide to close off those APIs.

**Extra disclaimer:** This is just a pet project I'm working on for fun (and to learn a bit about Discord bots) - don't expect super-tidy code or great documentation. If you encounter any issues with it, either open an issue on Github or talk to me on Discord (tooInfinite).

## What can this bot do? 🤖

**Public invite link:** [Click here!](https://discord.com/api/oauth2/authorize?client_id=807920588738920468&permissions=388160&scope=applications.commands%20bot)

**Note:** The bot is now using slash commands instead of the `!totd` prefix - if you've used the bot before, you'll need to simply use the invite link above to update its permissions.

- `/today` - Prints the current TOTD information to the current channel.
- `/leaderboard` - Prints the current TOTD top 10 and the time needed for top 100 to the current channel.
- `/ratings` - Prints the global ratings for a stored TOTD.
- `/rankings [time frame]` - Prints the TOTD rankings for the given time frame.
- `/bingo` - Prints this week's bingo board for the current server.
- `/lastbingo` - Prints last week's bingo board for the current server.
- `/votebingo [1-25]` - Starts a vote on that bingo field. All ongoing votes are resolved when the next TOTD is released.
- `/enable` - Stores the current channel to the list the daily scheduled TOTD post gets sent to. One channel per server. Admin only.
- `/disable` - Removes the current channel from the list the scheduled TOTD post gets sent to. Admin only.
- `/enablepings [@role] [region]` - Adds the role to the list of roles it pings 10 minutes before COTD. Daily TOTD posts have to be set up already. Supported regions for pings are `Europe`, `America`, and `Asia` - one for each official COTD. Admin only.
- `/disablepings [region]` - Removes the currently set role from the pings. Admin only.
- `/help` - Displays some info about the bot.
- `/invite` - Displays a link to invite the bot to your server.

Debug (and bot admin) only:

- `/refreshtotd` - Refreshes the internally cached TOTD information.
- `/refreshleaderboard` - Refreshes the internally cached leaderboard information.
- `/refreshratings` - Prints the current global ratings and a short verdict based on them (admin-only since it's not resolved yet).
- `/refreshbingo` - Regenerates the current bingo board.
- `/refreshbingocount` - Resolves the ongoing bingo field votes.
- `/servers` - Prints the current number of servers the bot is in. Also logs the server details.

## Screenshots 📷

![Screenshot today](https://i.imgur.com/gTiFt3S.png)
![Screenshot bingo](https://i.imgur.com/QnSKOPC.png)

## Setup/Development 💻

The bot is written in Node.js - so you'll need to install [Node](https://nodejs.org/en/), which automatically comes with NPM, the default package manager.

Note that the bot is generally built to be generic enough to run anywhere - the only exception are custom emojis, so you'll need to change the mappings in `./emojiMapping.json` to point to emojis and their IDs that your bot will have access to.

To run it, just run an `npm i` and an `npm start`. Make sure you've added a `.env` file (see the template for the format).

- `DISCORD_TOKEN` is the Discord bot's auth token (see any tutorial for more info).
- `USER_LOGIN` is your UPlay/Ubisoft Connect credentials - I suggest not using your main account. It doesn't have to own the game, so you can just create a new one for this bot.
- `DEPLOY_MODE` should only be `prod` if it's supposed to be live. Everything else is interpreted as a development mode (which means that all commands will be registered only in the admin server, and the bot won't reload all the data on startup).
- `REDIS_URL` is a Redis database - it's required for the scheduled messages and caching. If you're using an insecure instance for local development, you can omit the auth part.
- `ADMIN_TAG` is the Discord tag of the bot admin - used for administration commands that only they should be allowed to run.
- `ADMIN_SERVER_ID` and `ADMIN_CHANNEL_ID` are Discord IDs of the admin server and channel - used for all admin commands.

Every commit on `main` triggers an update to the live version of the bot running on a Heroku dyno.

## TODOs 📋

I consider the bot to be pretty much finished, but if I get back to it, this is what I'd probably look at.

- Add better error handling for when the bot doesn't have permissions to post an error message - probably add a global method for it.
- Add some server-specific ratings breakdown (i.e. store ratings per server so the ratings message can show both local and global ratings).
  - This might require some extra thought regarding scaling - since every new server increases the database size. It's not much, but I'd like to keep the footprint as minimal as possible (especially if the use case isn't really needed).
- Add a short info message when joining a new server (if there's a reliable way to find the "main" channel).
- More data (currently uses TM and TMX when available) - there's probably more interesting metadata the bot could display.
  - How many TOTDs did the author have before?
  - Current WR (but I guess that's not very useful when it gets TOTD)
  - Summary of the last TOTD with top 5 (incl. player links to tm.io and maybe some aggregate data like player numbers)
- Some general restructuring of the code and some more documentation of the existing functionality.
- Handling of non-JPG image files.

## Special Thanks ❤️

Thanks go to:

- Juice#7454 for the improved voting emojis.
- The [TMX](https://trackmania.exchange/) team for their platform and well-documented API.
- Miss ([@codecat](https://github.com/codecat)) for her work on [trackmania.io](https://trackmania.io).

## Terms of Service

When you invite this bot to your server or interact with it on another server, you agree to the following terms:

- You agree to the bot storing and logging information about your Discord account/server for debugging purposes. It will only be used to improve the bot's functionality and will never be shared with any third parties.
- You agree that you will not attempt to misuse the bot in any way - spamming commands and attempting to flood the bot with requests will result in a ban of your account/server.
- The bot owner has the right to deny you access to the bot's features for any reason.

## Privacy Policy

The TOTD Bot only stores data that is required for its core functionality:
- It stores server and channel IDs for all servers that set up scheduled posts with the bot - this data is removed as soon as the configuration is deleted by a server admin/whenever the bot can't access a given server anymore (i.e. when it was kicked).
- It also stores user IDs and the corresponding rating that a user submitted for the current TOTD to prevent people from voting more than once - this data is removed after a day.
- Apart from that, it only stores past TOTD data (map and rating information) to be able to display historical data to users.

Whenever the bot gets removed from a server with any configuration, it automatically removes that server's information from its datastore within a day.

For debugging purposes, the bot also logs user IDs, channel IDs and server IDs as well as the corresponding names when people interact with it. Logs are potentially stored indefinitely, but are of course also subject to deletion requests if a user requests that all their data is removed.

If you want to request information about or deletion of any of your data (user, message, channel or server IDs that are directly related to you), please contact the bot owner on Discord (tooInfinite).
