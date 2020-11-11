import Config from "./config.ts";

class PusherConfig {
    constructor(options) {
        Config.call(this, options);
        if (options.host) {
            this.host = options.host;
        }
        else if (options.cluster) {
            this.host = "api-" + options.cluster + ".pusher.com";
        }
        else {
            this.host = "api.pusherapp.com";
        }
    }

    prefixPath(subPath) {
        return "/apps/" + this.appId + subPath;
    }
}

Object.assign(PusherConfig.prototype, Config.prototype);
export default PusherConfig;
