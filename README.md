# TOTD Discord Bot

This is a Discord bot for displaying the daily [Trackmania](https://www.trackmania.com/) Track of the Day (and maybe more in the future).

**Disclaimer:** This bot uses undocumented APIs (and libraries based on them), so it may break at any time - potentially indefinitely if Nadeo/Ubisoft decide to close off those APIs.

**Extra disclaimer:** This is just a pet project I'm working on for fun (and to learn a bit about Discord bots) - don't expect super-tidy code or great documentation. If you encounter any issues with it, either open an issue on Github or talk to me on Discord (tooInfinite#5113).

## What can this bot do? 🤖

**Public invite link:** [Click here!](https://discord.com/api/oauth2/authorize?client_id=807920588738920468&permissions=388160&scope=bot)

Use at your own risk - the bot is in development and may break from time to time.

- `!totd today` - Prints the current TOTD information to the current channel.
- `!totd leaderboard` - Prints the current TOTD top 10 and the time needed for top 100 to the current channel.
- `!totd verdict` - Prints yesterday's global ratings and a short verdict based on them.
- `!totd ratings` - Prints today's global ratings.
- `!totd bingo` - Prints this week's bingo board.
- `!totd last bingo` - Prints last week's bingo board.
- `!totd vote [1-25]` - Starts a vote on that bingo field. All ongoing votes are resolved when the next TOTD is released.
- `!totd enable` - Stores the current channel to the list the daily scheduled TOTD post gets sent to. One channel per server. Admin only.
- `!totd disable` - Removes the current channel from the list the scheduled TOTD post gets sent to. Admin only.
- `!totd set role [@role] [region]` - Adds the role to the list of roles it pings 10 minutes before COTD. Daily TOTD posts have to be set up already. Admin only.
- `!totd remove role [region]` - Removes the currently set role from the pings. Admin only.
- `!totd help` - Displays some info about the bot.

Supported regions for pings are `Europe`, `America`, and `Asia` - one for each official COTD.

Debug (and bot admin) only:

- `!totd refresh today` - Refreshes the internally cached TOTD information.
- `!totd refresh leaderboard` - Refreshes the internally cached leaderboard information.
- `!totd refresh ratings` - Prints the current global ratings and a short verdict based on them (admin-only since it's not resolved yet).
- `!totd refresh bingo` - Regenerates the current bingo board.
- `!totd refresh count` - Resolves the ongoing bingo field votes.

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
- `ADMIN_TAG` is the Discord tag of the bot admin - mainly used for undocumented debug commands that only they should be allowed to run.

Every commit on `main` triggers an update to the live version of the bot running on a Heroku dyno.

## TODOs 📋

I consider the bot to be pretty much finished, but if I ever get back to it, this is what I'd probably look at.

- Find better voting emojis - the current ones are just screenshots from TMNF.
- Add a short info message when joining a new server (if there's a reliable way to find the "main" channel).
- More data (currently uses TM and TMX when available) - there's probably more interesting metadata the bot could display.
  - How many TOTDs did the author have before?
  - Current WR (but I guess that's not very useful when it gets TOTD)
  - Summary of the last TOTD with top 5 (incl. player links to tm.io and maybe some aggregate data like player numbers)
- Some general restructuring of the code and some more documentation of the existing functionality.
- Handling of non-JPG image files.

## Special Thanks ❤️

Thanks go to:

- The [TMX](https://trackmania.exchange/) team for their platform and well-documented API.
- Miss ([@codecat](https://github.com/codecat)) for her work on [trackmania.io](https://trackmania.io).
- [@breeku](https://github.com/breeku) for creating [a neat wrapper](https://github.com/breeku/trackmania-api-node) around a bunch of reverse-engineered Nadeo APIs (let's hope they don't break).
