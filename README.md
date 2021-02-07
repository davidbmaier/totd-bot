# TOTD Discord Bot

This is a Discord bot for displaying the daily Trackmania Track of the Day (and maybe more in the future).

Disclaimer: This bot uses undocumented APIs (and libraries based on them), so it may break at any time - potentially indefinitely if Nadeo/Ubisoft decide to close off those APIs.

## Setup/Development

The bot is written in Node.js - so you'll need to install [Node](https://nodejs.org/en/), which automatically comes with NPM, the default package manager.

To run it, just run an `npm i` and an `npm start`. Make sure you've added a `.env` file (see the template for the format).
I suggest not using your main UPlay/Ubisoft Connect account - it doesn't have to own the game, so you can just create a new one for this bot.

Currently, it only listens to `!totd` and the prints the current track's data.

## Planned features

- Automatically posting on a schedule (when the new TOTD comes out) - this probably requires some external storage to keep track of the servers it has to send it to (or some simple logic like looking for a channel name pattern).
- Looking up previous TOTDs using a date.
- More data (currently uses TM and TMX when available) - there's probably more interesting metadata the bot could display.
- Set up easy deployment (maybe through a Github action) to an arbitrary server (maybe also just to a Cloud provider to make it easy) - currently I've only run it locally for test purposes.
