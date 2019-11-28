const allowedMedia = process.env.PLEX_MEDIA.split(',');

module.exports = {
    port: process.env.APP_PORT,
    ifttt_key: process.env.IFTTT_KEY,
    webhook_url: process.env.WEBHOOK_URL,
    location: {
        latitude: process.env.LOCATION_LAT,
        longitude: process.env.LOCATION_LONG,
    },
    plex: {
        webhooks: true,
        media: [
            ...allowedMedia
        ],
    }
};