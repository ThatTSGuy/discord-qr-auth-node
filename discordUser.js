class DiscordUser {
    constructor(userPayload) {
        const user = userPayload.split(':');

        this.id = user[0];
        this.discriminator = user[1];
        this.avatarUrl = `https://cdn.discordapp.com/avatars/${user[0]}/${user[2]}.png`;
        this.username = user[3];
    }
}

module.exports = DiscordUser;