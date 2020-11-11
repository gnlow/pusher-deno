import Config from "./config.ts";
const DEFAULT_HOST = "nativepush-cluster1.pusher.com";
const API_PREFIX = "server_api";
const API_VERSION = "v1";

class NotificationConfig {
    constructor(options) {
        Config.call(this, options);
        this.host = options.host || DEFAULT_HOST;
    }

    prefixPath(subPath) {
        return "/" + API_PREFIX + "/" + API_VERSION + "/apps/" + this.appId + subPath;
    }
}

Object.assign(NotificationConfig.prototype, Config.prototype);
export default NotificationConfig;
