const DiscordAuthWebSocket = require('./index.js');

const wsAuth = new DiscordAuthWebSocket(true);

wsAuth.on('user', user => {
    console.log(user);
})

wsAuth.on('token', token => {
    console.log(token);
})