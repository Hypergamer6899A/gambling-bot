This is a stupid little gambling discord bot.
It's supposed to be ran on render, it will not work on its own
It relies on firebase. You'll need a firebase project with a database
When using render, you'll need 6 environment variables: \
CLIENT_ID: The bot's ID \
FIREBASE_CLIENT_EMAIL \
FIREBASE_PRIVATE_KEY \
FIREBASE_PROJECT_ID \
GUILD_ID: Id of the server \
TOKEN: The bot's token

Most scripts have a channel Id variable. Set that to the channel id for the channel you want people to gamble in.
Also make a role for the top 3 richest gamblers and put that role ID in topRoles.js.
Most of this was revised by ChatGPT (I suck at writing JavaScript).
Ya thats it. Goodluck trying to make this work.
