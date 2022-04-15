# TOTD Discord Bot

This is a Discord bot for displaying the daily [Trackmania](https://www.trackmania.com/) Track of the Day (and a few other things).

**Disclaimer:** This bot uses undocumented APIs (and libraries based on them), so it may break at any time - potentially indefinitely if Nadeo/Ubisoft decide to close off those APIs.

**Extra disclaimer:** This is just a pet project I'm working on for fun (and to learn a bit about Discord bots) - don't expect super-tidy code or great documentation. If you encounter any issues with it, either open an issue on Github or talk to me on Discord (tooInfinite#5113).

## What can this bot do? 🤖

**Public invite link:** [Click here!](https://discord.com/api/oauth2/authorize?client_id=807920588738920468&permissions=388160&scope=applications.commands%20bot)

**Note:** The bot is now using slash commands instead of the `!totd` prefix - if you've used the bot before, you'll need to simply use the invite link above to update its permissions.

- `/today` - Prints the current TOTD information to the current channel.
- `/leaderboard` - Prints the current TOTD top 10 and the time needed for top 100 to the current channel.
- `/verdict` - Prints yesterday's global ratings and a short verdict based on them.
- `/ratings` - Prints today's global ratings.
- `/rankings [time frame]` - Prints the TOTD rankings for the given time frame. Supported time frames are `this month`, `last month`, `this year`, `last year`, and `all time`.
- `/bingo` - Prints this week's bingo board.
- `/lastbingo` - Prints last week's bingo board.
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
- `DEPLOY_MODE` should only be `prod` if it's supposed to be live. Everything else is interpreted as a development mode (which means that all commands will be prefixed with `dev` - e.g. `!devtotd today`).
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
- [@breeku](https://github.com/breeku) for creating [a neat wrapper](https://github.com/breeku/trackmania-api-node) around a bunch of reverse-engineered Nadeo APIs (let's hope they don't break).
