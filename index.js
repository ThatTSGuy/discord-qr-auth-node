const WebSocketClient = require('websocket').client;
const Crypto = require('crypto');
const qr = require('qrcode');
const { EventEmitter } = require('events');

const { Messages, Discord } = require('./constants.js');
const DiscordUser = require('./discordUser');

class DiscordAuthWebSocket extends EventEmitter {
    constructor(debug) {
        super();

        this.debug = debug;

        this.wsStart();
    }

    log(message) {
        if (this.debug) console.log(`[${Date.now() - this.ts}ms] ${message}\n`);
    }

    wsStart() {
        this.keys = this.getKeyPair();

        this.ws = new WebSocketClient();
        this.ws.on('connect', this.wsConnect.bind(this));
        this.ws.on('connectFailed', this.wsConnectFail.bind(this));
        this.ws.connect(Discord.GATEWAY, null, Discord.ORIGIN);
    }

    wsConnect(stream) {
        this.ts = Date.now();
        this.log(`Connected to ${Discord.GATEWAY}`);

        stream.on('message', this.wsMessage.bind(this));
        this.stream = stream;
    }

    wsConnectFail(reason) {
        console.error(reason);
    }

    wsMessage(message) {
        const { op, ...payload } = JSON.parse(message.utf8Data);
        this.log(`↓ ${op}${Object.keys(payload).length == 0 ? '' :  `\n${JSON.stringify(payload)}\n`}`);

        switch (op) {
            case Messages.HELLO:
                this.heartbeat = setInterval(() => {
                    this.wsSend(Messages.HEARTBEAT);
                }, payload.heartbeat_interval);

                this.timeout = setTimeout(() => {
                    this.emit('timeout');

                    this.log('Timeout');

                    this.destroy();
                    this.wsStart();
                }, payload.timeout_ms);

                this.wsSend(Messages.INIT, { encoded_public_key: this.keys.public });
                break;

            case Messages.NONCE_PROOF:
                const nonce = this.decryptPayload(payload.encrypted_nonce);

                const proof = Crypto.createHash('sha256')
                    .update(nonce)
                    .digest('base64')
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/, '');

                this.wsSend(Messages.NONCE_PROOF, { proof });
                break;

            case Messages.PENDING_REMOTE_INIT:
                const url = `https://discordapp.com/ra/${payload.fingerprint}`;

                qr.toDataURL(url, { margin: 0 }).then(qrCodeURI => this.emit('qrCode', qrCodeURI));
                qr.toString(url).then(qrCodeString => this.log(`Scan QR code: ${qrCodeString}`));
                break;

            case Messages.PENDING_FINISH:
                const userPayload = this.decryptPayload(payload.encrypted_user_payload).toString('ascii');

                const user = new DiscordUser(userPayload);

                this.emit('user', user);
                break;

            case Messages.FINISH:
                const token = this.decryptPayload(payload.encrypted_token).toString('ascii');

                this.emit('token', token);

                this.destroy();
                break;

            case Messages.CANCEL:
                this.emit('cancel')

                this.log('Disconnecting');

                this.destroy();
                this.wsStart();
                break;
        }
    }

    wsSend(op, message) {
        const payload = { op, ...message };
        this.stream.send(JSON.stringify(payload));

        this.log(`↑ ${op}${message ? `\n${JSON.stringify(message)}\n` : ''}`);
    }

    decryptPayload(payload) {
        const buffer = Buffer.from(payload, 'base64');

        return Crypto.privateDecrypt({
            key: this.keys.private,
            padding: Crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256',
        }, buffer);
    }

    getKeyPair() {
        const keys = Crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'der' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        })

        return {
            public: keys.publicKey.toString('base64'),
            private: keys.privateKey,
        }
    }

    destroy() {
        this.log('Destroying');

        clearInterval(this.heartbeat);
        clearTimeout(this.timeout);

        this.stream.close();
    }
}

module.exports = DiscordAuthWebSocket;