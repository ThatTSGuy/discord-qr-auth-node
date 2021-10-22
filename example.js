const DiscordAuthWebSocket = require('./index.js');

const wsAuth = new DiscordAuthWebSocket(true);

wsAuth.on('qrCode', qrCode => {
    console.log('Got qrCode: ' + qrCode);
})

wsAuth.on('user', user => {
    console.log('Got user: ' + JSON.stringify(user));
})

wsAuth.on('token', token => {
    console.log('Got token: ' + token);
})

wsAuth.on('timeout', () => {
    console.log('Got timeout');
})

wsAuth.on('cancel', () => {
    console.log('Got cancel');
})