import { createHash } from "https://deno.land/std@0.77.0/hash/mod.ts";
import url from "https://deno.land/std@0.77.0/node/url.ts";
import * as auth from "./auth.js";
import * as errors from "./errors.js";
import * as events from "./events.js";
import * as requests from "./requests.js";
import PusherConfig from "./pusher_config.js";
import Token from "./token.js";
import WebHook from "./webhook.js";
import NotificationClient from "./notification_client.js";
const validateChannel = function (channel) {
    if (typeof channel !== "string" ||
        channel === "" ||
        channel.match(/[^A-Za-z0-9_\-=@,.;]/)) {
        throw new Error("Invalid channel name: '" + channel + "'");
    }
    if (channel.length > 200) {
        throw new Error("Channel name too long: '" + channel + "'");
    }
};
const validateSocketId = function (socketId) {
    if (typeof socketId !== "string" ||
        socketId === "" ||
        !socketId.match(/^\d+\.\d+$/)) {
        throw new Error("Invalid socket id: '" + socketId + "'");
    }
};
/** Provides access to Pusher's REST API, WebHooks and authentication.
 *
 * @constructor
 * @param {Object} options
 * @param {String} [options.host="api.pusherapp.com"] API hostname
 * @param {String} [options.notification_host="api.pusherapp.com"] Notification API hostname
 * @param {Boolean} [options.useTLS=false] whether to use TLS
 * @param {Boolean} [options.encrypted=false] deprecated; renamed to `useTLS`
 * @param {Boolean} [options.notification_encrypted=false] whether to use TLS for notifications
 * @param {Integer} [options.port] port, default depends on the scheme
 * @param {Integer} options.appId application ID
 * @param {String} options.key application key
 * @param {String} options.secret application secret
 * @param {Integer} [options.timeout] request timeout in milliseconds
 * @param {Agent} [options.agent] http agent to use
 */
function Pusher(options) {
    this.config = new PusherConfig(options);
    const notificationOptions = Object.assign({}, options, {
        host: options.notificationHost,
        encrypted: options.notificationEncrypted,
    });
    this.notificationClient = new NotificationClient(notificationOptions);
}
/** Create a Pusher instance using a URL.
 *
 * URL should be in SCHEME://APP_KEY:SECRET_KEY@HOST:PORT/apps/APP_ID form.
 *
 * @param {String} pusherUrl URL containing endpoint and app details
 * @param {Object} [options] options, see the {@link Pusher} for details
 * @returns {Pusher} instance configured for the URL and options
 */
Pusher.forURL = function (pusherUrl, options) {
    const apiUrl = url.parse(pusherUrl);
    const apiPath = apiUrl.pathname.split("/");
    const apiAuth = apiUrl.auth.split(":");
    return new Pusher(Object.assign({}, options || {}, {
        scheme: apiUrl.protocol.replace(/:$/, ""),
        host: apiUrl.hostname,
        port: parseInt(apiUrl.port, 10) || undefined,
        appId: parseInt(apiPath[apiPath.length - 1], 10),
        key: apiAuth[0],
        secret: apiAuth[1],
    }));
};
/** Create a Pusher instance using a cluster name.
 *
 * @param {String} cluster cluster name
 * @param {Object} [options] options, see the {@link Pusher} for details
 * @returns {Pusher} instance configured for the cluster and options
 */
Pusher.forCluster = function (cluster, options) {
    return new Pusher(Object.assign({}, options || {}, {
        host: "api-" + cluster + ".pusher.com",
    }));
};
/** Returns a signature for given socket id, channel and socket data.
 *
 * @param {String} socketId socket id
 * @param {String} channel channel name
 * @param {Object} [data] additional socket data
 * @returns {String} authentication signature
 */
Pusher.prototype.authenticate = function (socketId, channel, data) {
    validateSocketId(socketId);
    validateChannel(channel);
    return auth.getSocketSignature(this, this.config.token, channel, socketId, data);
};
/** Triggers an event.
 *
 * Channel names can contain only characters which are alphanumeric, '_' or '-'
 * and have to be at most 200 characters long.
 *
 * Event name can be at most 200 characters long.
 *
 * Returns a promise resolving to a response, or rejecting to a RequestError.
 *
 * @param {String|String[]} channel list of at most 100 channels
 * @param {String} event event name
 * @param data event data, objects are JSON-encoded
 * @param {String} [socketId] id of a socket that should not receive the event
 * @see RequestError
 */
Pusher.prototype.trigger = function (channels, event, data, socketId) {
    if (socketId) {
        validateSocketId(socketId);
    }
    if (!(channels instanceof Array)) {
        // add single channel to array for multi trigger compatibility
        channels = [channels];
    }
    if (event.length > 200) {
        throw new Error("Too long event name: '" + event + "'");
    }
    if (channels.length > 100) {
        throw new Error("Can't trigger a message to more than 100 channels");
    }
    for (let i = 0; i < channels.length; i++) {
        validateChannel(channels[i]);
    }
    return events.trigger(this, channels, event, data, socketId);
};
/* Triggers a batch of events
 *
 * @param {Event[]} An array of events, where Event is
 * {
 *   name: string,
 *   channel: string,
 *   data: any JSON-encodable data
 * }
 */
Pusher.prototype.triggerBatch = function (batch) {
    return events.triggerBatch(this, batch);
};
Pusher.prototype.notify = function () {
    this.notificationClient.notify.apply(this.notificationClient, arguments);
};
/** Makes a POST request to Pusher, handles the authentication.
 *
 * Returns a promise resolving to a response, or rejecting to a RequestError.
 *
 * @param {Object} options
 * @param {String} options.path request path
 * @param {Object} options.params query params
 * @param {String} options.body request body
 * @see RequestError
 */
Pusher.prototype.post = function (options) {
    return requests.send(this.config, Object.assign({}, options, { method: "POST" }));
};
/** Makes a GET request to Pusher, handles the authentication.
 *
 * Returns a promise resolving to a response, or rejecting to a RequestError.
 *
 * @param {Object} options
 * @param {String} options.path request path
 * @param {Object} options.params query params
 * @see RequestError
 */
Pusher.prototype.get = function (options) {
    return requests.send(this.config, Object.assign({}, options, { method: "GET" }));
};
/** Creates a WebHook object for a given request.
 *
 * @param {Object} request
 * @param {Object} request.headers WebHook HTTP headers with lower-case keys
 * @param {String} request.rawBody raw WebHook body
 * @returns {WebHook}
 */
Pusher.prototype.webhook = function (request) {
    return new WebHook(this.config.token, request);
};
/** Builds a signed query string that can be used in a request to Pusher.
 *
 * @param {Object} options
 * @param {String} options.method request method
 * @param {String} options.path request path
 * @param {Object} options.params query params
 * @param {String} options.body request body
 * @returns {String} signed query string
 */
Pusher.prototype.createSignedQueryString = function (options) {
    return requests.createSignedQueryString(this.config.token, options);
};
Pusher.prototype.channelSharedSecret = function (channel) {
    return createHash("sha256")
        .update(channel + this.config.encryptionMasterKey)
        .digest();
};
/** Exported {@link Token} constructor. */
Pusher.Token = Token;
/** Exported {@link RequestError} constructor. */
Pusher.RequestError = errors.RequestError;
/** Exported {@link WebHookError} constructor. */
Pusher.WebHookError = errors.WebHookError;
export default Pusher;
