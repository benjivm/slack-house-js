const fs = require('fs');
const axios = require('axios');
const LifxLan = require('node-lifx-lan');

function LifxLanApi () {
    this._lights = [];
    this._selectors = [];

    this.getLights = function () {
        return this._lights;
    };

    this.getScenes = function (name) {
        const scenes = JSON.parse(fs.readFileSync('scenes.json'));

        if (name) {
            return scenes.find(scene => scene.name === name);
        }

        return scenes;
    };

    this.discoverLights = async () => {
        await LifxLan.discover().then(discoveredLights => {
            let selectors = [];
            this._lights = discoveredLights;
            this._lights.forEach(light => {
                selector = {
                    selector: 'id:' + light.mac.toLowerCase().replace(/\:/g, ''),
                    label: light.deviceInfo.label
                };

                selectors.push(selector);
            });

            this._selectors = selectors;
        }).catch(err => console.log(err));
    };

    this.activateScene = async (sceneName, duration) => {
        const scene = this.getScenes(sceneName);

        if (!scene) {
            throw (`${sceneName} does not exist. Try resyncing with LIFX Cloud.`);
        }

        const sceneLights = scene.lights.filter(light => {
            return light.power;
        }).map(light => {
            return light;
        });

        const powerOffFilter = scene.lights.filter(light => {
            return !light.power;
        }).map(light => {
            return light.filters;
        });

        if (powerOffFilter.length) {
            await LifxLan.turnOffFilter({
                filters: powerOffFilter,
                duration: duration
            }).catch(err => console.log('Power off failed with error: ' + err));
        }

        sceneLights.forEach(light => {
            LifxLan.turnOnFilter({
                ...light,
                duration: duration
            }).catch(err => console.log(light.label + ' failed with error: ' + err));
        });
    };

    this.broadcastOn = async (color, duration) => {
        await LifxLan.turnOnBroadcast({
            color: color,
            duration: duration
        }).catch(err => console.log('Could not brodcast on: ' + err));
    };

    this.broadcastOff = async (duration) => {
        await LifxLan.turnOffBroadcast({
            duration: duration
        }).catch(err => console.log('Could not brodcast off: ' + err));
    };

    this.downloadScenes = async () => {
        await axios.get('https://api.lifx.com/v1/scenes', {
            headers: {
                Authorization: `Bearer ${process.env.LIFX_TOKEN}`
            }
        }).then(async (response) => {
            const sceneData = response.data;
            let scenes = await sceneData.map(scene => {
                let sceneFilter = {
                    name: scene.name,
                    lights: scene.states.map(light => {
                        let selector = this._selectors.find(s => s.selector === light.selector);
                        return {
                            filters: [{
                                label: selector.label
                            }],
                            power: light.power === "on" ? 1 : 0,
                            color: {
                                hue: light.color.hue ? light.color.hue / 360 : 0,
                                saturation: light.color.saturation,
                                kelvin: light.color.kelvin,
                                brightness: light.brightness
                            }
                        };
                    })
                };

                return sceneFilter;
            });

            await fs.writeFileSync('scenes.json', JSON.stringify(scenes, null, 2));
        }).catch(err => console.log(err));
    };
}

module.exports = LifxLanApi;