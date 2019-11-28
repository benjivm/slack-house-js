'use strict';

require('dotenv').config();
const Koa = require('koa');
const logger = require('koa-pino-logger');
const Router = require('koa-router');
const koaBody = require('koa-body');
const Discord = require('webhook-discord');
const IftttApi = require('node-ifttt-maker');
const LifxLanApi = require('./lifx');
const JobManager = require('./jobs');

let config = require('./config');
let app = new Koa();
let router = new Router();
let ifttt = new IftttApi(config.ifttt_key);
let lifx = new LifxLanApi();
let jobs = new JobManager(lifx, config.location);
let discord = new Discord.Webhook(config.webhook_url);

// Handle IFTTT webhooks
router.post('/webhook/ifttt', async (ctx) => {
    const payload = ctx.request.body;

    if (payload.key !== config.ifttt_key || !payload.type || !payload.command) {
        discord.err('Slack House', `Webhook failed: ${JSON.stringify(ctx.request.body)}`);

        return ctx.body = 'That will not work.';
    }

    if (payload.type === 'app') {
        if (payload.command === 'enable_plex_webhooks') {
            config.plex.webhooks = true;
            discord.success('Slack House', `Plex webhooks ${config.plex.webhooks ? 'enabled' : 'disabled'}`);

            return ctx.body = 'Plex command handled.';
        }

        if (payload.command === 'disable_plex_webhooks') {
            config.plex.webhooks = false;
            discord.success('Slack House', `Plex webhooks ${config.plex.webhooks ? 'enabled' : 'disabled'}`);

            return ctx.body = 'Plex command handled.';
        }
    }

    if (payload.type === 'home') {
        if (payload.command === 'activate_movie_time') {
            config.plex.webhooks = true;
            await lifx.activateScene('Movie Time Scene', 5000);

            await ifttt.request('turn_tv_plug_on')
                .catch(err => console.log(err));

            await ifttt.request('start_shield_activity')
                .catch(err => console.log(err));

            discord.success('Slack House', 'Movie time activated!');

            return ctx.body = 'Movie time activated!';
        }

        if (payload.command === 'activate_bed_time') {
            await ifttt.request('turn_tv_plug_off')
                .catch(err => console.log(err));

            await ifttt.request('fade_all_lights_off')
                .catch(err => console.log(err));

            discord.success('Slack House', 'Goodnight.');

            return ctx.body = 'Goodnight.';
        }
    }

    discord.err('Slack House', `Webhook failed: ${JSON.stringify(ctx.request.body)}`);

    ctx.body = 'That will not work.';
});

// Handle Plex webhooks
router.post('/webhook/plex', async (ctx) => {
    const payload = ctx.request.body;

    if (!config.plex.webhooks || !config.plex.media.includes(payload.type)) {
        let reason;

        if (!config.plex.webhooks) {
            reason = 'Webhooks are disabled.';
        }

        if (!config.plex.media.includes(payload.type)) {
            reason = `"${payload.type}" is not a whitelisted media type.`;
        }

        discord.err('Slack House', `Plex webhook failed: ${reason}`);

        return ctx.body = 'That will not work.';
    }

    if (payload.event === 'play') {
        await lifx.broadcastOff(60000);

        discord.success('Slack House', `Started playing **${payload.title}**`);

        return ctx.body = 'Play handled.';
    }

    if (payload.event === 'pause') {
        await lifx.broadcastOn({
            'hue': 0.9638,
            'saturation': 0,
            'kelvin': 2600,
            'brightness': 0.50
        }, 3000);

        discord.info('Slack House', `Paused **${payload.title}**`);

        return ctx.body = 'Pause handled.';
    }

    if (payload.event === 'resume') {
        await lifx.broadcastOff(5000);
        discord.success('Slack House', `Resumed **${payload.title}**`);

        return ctx.body = 'Resume handled.';
    }

    if (payload.event === 'stop') {
        await lifx.activateScene('Warm Night', 30000);

        discord.info('Slack House', `Stopped **${payload.title}**`);
        return ctx.body = 'Stop handled.';
    }

    ctx.body = 'That will not work.';
});

// (Re)download all scenes from LIFX Cloud account
router.get('/scenes', async (ctx) => {
    await lifx.downloadScenes().then(() => {
        discord.success('Slack House', 'All scenes downloaded from LIFX cloud account.');

        ctx.body = 'All scenes downloaded from LIFX cloud account.';
    }).catch(() => {
        discord.warn('Slack House', 'There was an error downloading the scenes from your LIFX account, check logs.');

        ctx.body = 'There was an error downloading your scenes from your LIFX account, check console.';
    });
});

router.put('/scenes', async (ctx) => {
    const payload = ctx.request.body;
    await lifx.activateScene(payload.name, payload.duration).then(() => {
        ctx.body = `${payload.name} activated in ${payload.duration}ms`;
    }).catch(err => ctx.body = err);
});

// (Re)discover all LIFX lights
router.get('/discover', async (ctx) => {
    await lifx.discoverLights();

    ctx.body = `Discovered ${lifx.getLights().length} lights.`;
});

// Configure Koa
app.use(logger())
    .use(koaBody())
    .use(router.routes());

// Boot her up!
app.listen(config.port, async () => {
    await lifx.discoverLights()
        .then(() => discord.success('Slack House', `Discovered ${lifx.getLights().length} lights.`))
        .catch(err => discord.err('Slack House', `Light discovery failed: ${err}`));

    await jobs.scheduleAll().then(() => {
        discord.info('Slack House', `**New sunrise/sunset jobs scheduled**:
        ☀ *Sunrise*: ${jobs.scheduled.sunriseJob.nextInvocation().getHours()}:${jobs.scheduled.sunriseJob.nextInvocation().getMinutes()} on day ${jobs.scheduled.sunriseJob.nextInvocation().getDay()}
        ✨ *Sunset*: ${jobs.scheduled.sunsetJob.nextInvocation().getHours()}:${jobs.scheduled.sunsetJob.nextInvocation().getMinutes()} on day ${jobs.scheduled.sunsetJob.nextInvocation().getDay()}`);
    }).catch(err => discord.err('Slack House', `Sunrise/sunset scheduler failed: ${err}`));

    await lifx.downloadScenes().then(() => {
        discord.info('Slack House', 'All scenes downloaded from LIFX account');
    }).catch(err => discord.err('Slack House', `Scene download failed: ${err}`));

    console.log(`Slack House is running!
    |-- 🌐 http://localhost:${config.port}
    |-- 💡 Discovered ${lifx.getLights().length} lights and downloaded LIFX scenes.`);
});