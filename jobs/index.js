const scheduler = require('node-schedule');
const SunCalc = require('suncalc');

function JobManager (lifx, location) {
    this.lifx = lifx;
    this.schedulerRan = false,
    this.location = location;
    this.scheduled = {
        sunriseJob: null,
        sunsetJob: null 
    };

    this.scheduleAll = async () => {
        let now = await new Date();
        let sunTimes = await SunCalc.getTimes(now, this.location.latitude, this.location.longitude);
    
        // Create Rule: Power on all lights 15 minutes before sunrise
        let sunrise = await new Date(sunTimes.sunrise - (20 * 60000));
        let sunriseRule = await new scheduler.RecurrenceRule();
        sunriseRule.dayOfWeek = now.getDay();
        sunriseRule.hour = sunrise.getHours();
        sunriseRule.minute = sunrise.getMinutes();

        // Create Rule: Power off all lights 15 minutes before sunset
        let sunset = await new Date(sunTimes.sunset - (20 * 60000));
        let sunsetRule = await new scheduler.RecurrenceRule();
        sunsetRule.dayOfWeek = now.getDay();
        sunsetRule.hour = sunset.getHours();
        sunsetRule.minute = sunset.getMinutes();

        // Schedule Job: Power on all lights 15 minutes before sunrise
        if (this.scheduled.sunriseJob) {
            this.scheduled.sunriseJob.reschedule(sunriseRule);
        } else {
            this.scheduled.sunriseJob = scheduler.scheduleJob('sunriseJob', sunriseRule, async () => {
                await lifx.activateScene('Wake Up', (10 * 60000));
            });
        }

        // Schedule Job: Power off all lights 15 minutes before sunset
        if (this.scheduled.sunsetJob) {
            this.scheduled.sunsetJob.reschedule(sunsetRule);
        } else {
            this.scheduled.sunsetJob = scheduler.scheduleJob('sunsetJob', sunsetRule, async () => {
                await lifx.activateScene('Warm Night', (10 * 60000));
            });
        }

        if (!this.schedulerRan) {
            await this.scheduleNextSunriseAndSunset();
            this.schedulerRan = true;
        }
    };

    this.scheduleNextSunriseAndSunset = async () => {
        // Reschedule the Sunrise/Sunset jobs with every day's sun data
        scheduler.scheduleJob('scheduleNextSunriseAndSunset', '0 1 * * *', () => {
            this.scheduleSunriseAndSunset();
        });
    };
}

module.exports = JobManager;