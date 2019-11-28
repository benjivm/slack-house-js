# Slack House JS

A JavaScript version of my [Slack House](https://github.com/benjivm/slack-house) project.

Uses the LIFX LAN protocol instead of the HTTP API so that lights can be controlled independent of internet connection. Also switched to Tautulli's webhooks over Plex Pass's integration. Uses SunCalc to calculate proper sunset and sunset time every day to activate morning and night scenes.

This is a personal app but maybe you'll find something useful in it. Please let me know if you improve on it or use it for something cool.

## Tautulli

This app responds to the following [payloads from Tautulli](https://github.com/Tautulli/Tautulli-Wiki/wiki/Notification-Agents-Guide#webhook):

```json
{
    "event":"{action}",
    "title":"{title}",
    "type":"{media_type}"
}
```

## Setup

* Clone the repo
* Install dependencies: `npm i --no-dev`
* Create your scene file: `echo [] > scenes.json`
* Create your environment file: `cp .env.example .env` (don't forget to edit it)
* Use pm2 to start the daemon: `sudo pm2 start slack-house.json`