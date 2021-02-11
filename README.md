# TOTD Discord Bot

This is a Discord bot for displaying the daily [Trackmania](https://www.trackmania.com/) Track of the Day (and maybe more in the future).

Disclaimer: This bot uses undocumented APIs (and libraries based on them), so it may break at any time - potentially indefinitely if Nadeo/Ubisoft decide to close off those APIs.

Currently, it posts every day at just after 7PM. It also posts when triggered by `!totd` in any channel it has access to.

## Setup/Development

The bot is written in Node.js - so you'll need to install [Node](https://nodejs.org/en/), which automatically comes with NPM, the default package manager.

To run it, just run an `npm i` and an `npm start`. Make sure you've added a `.env` file (see the template for the format).
I suggest not using your main UPlay/Ubisoft Connect account - it doesn't have to own the game, so you can just create a new one for this bot.

Every commit on main triggers an update to the live version of the bot running on a Heroku dyno.

## Planned features

- Some external storage to keep track of the servers it has to send the message to (or some simple logic like looking for a channel name pattern).
- More data (currently uses TM and TMX when available) - there's probably more interesting metadata the bot could display.
