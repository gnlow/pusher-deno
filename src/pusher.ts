import type { PusherT } from "./types.ts"

import { createHash } from "https://deno.land/std@0.77.0/hash/mod.ts";
import * as auth from "./auth.ts";
import * as errors from "./errors.ts";
import * as events from "./events.ts";
import * as requests from "./requests.ts";
import PusherConfig from "./pusher_config.ts";
import Token from "./token.ts";
import WebHook from "./webhook.ts";
import NotificationClient from "./notification_client.ts";
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
 * @param options
 * @param [options.host="api.pusherapp.com"] API hostname
 * @param [options.notification_host="api.pusherapp.com"] Notification API hostname
 * @param [options.useTLS=false] whether to use TLS
 * @param [options.encrypted=false] deprecated; renamed to `useTLS`
 * @param [options.notification_encrypted=false] whether to use TLS for notifications
 * @param [options.port] port, default depends on the scheme
 * @param options.appId application ID
 * @param options.key application key
 * @param options.secret application secret
 * @param [options.timeout] request timeout in milliseconds
 */
class Pusher {
	public config: any;
    public notificationClient: any;
    /** Exported {@link Token} constructor. */
    static Token = Token;
    /** Exported {@link RequestError} constructor. */
    static RequestError = errors.RequestError;
    /** Exported {@link WebHookError} constructor. */
    static WebHookError = errors.WebHookError;

    constructor(options: PusherT.Options) {
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
     * @param pusherUrl URL containing endpoint and app details
     * @param for details
     * @returns instance configured for the URL and options
     */
    static forURL(pusherUrl: string, options?: Partial<PusherT.Options>) {
        const apiUrl = new URL(pusherUrl);
        const apiPath = apiUrl.pathname.split("/");
        return new Pusher(Object.assign({}, options || {}, {
            scheme: apiUrl.protocol.replace(/:$/, ""),
            host: apiUrl.hostname,
            port: parseInt(apiUrl.port, 10) || undefined,
            appId: parseInt(apiPath[apiPath.length - 1], 10),
            key: apiUrl.username,
            secret: apiUrl.password,
        }));
    }

    /** Create a Pusher instance using a cluster name.
     *
     * @param cluster cluster name
     * @param for details
     * @returns instance configured for the cluster and options
     */
    static forCluster(cluster: string, options: PusherT.BaseOptions): Pusher {
        return new Pusher(Object.assign({}, options || {}, {
            host: "api-" + cluster + ".pusher.com",
        }));
    }

    /** Returns a signature for given socket id, channel and socket data.
     *
     * @param socketId socket id
     * @param channel channel name
     * @param [data] additional socket data
     * @returns authentication signature
     */
    authenticate(
        socketId: string,
        channel: string,
        data?: PusherT.PresenceChannelData
    ): PusherT.AuthResponse {
        validateSocketId(socketId);
        validateChannel(channel);
        return auth.getSocketSignature(this, this.config.token, channel, socketId, data);
    }

    /** Triggers an event.
     *
     * Channel names can contain only characters which are alphanumeric, '_' or '-'
     * and have to be at most 200 characters long.
     *
     * Event name can be at most 200 characters long.
     *
     * Returns a promise resolving to a response, or rejecting to a RequestError.
     *
     * @param channel list of at most 100 channels
     * @param event event name
     * @param data event data, objects are JSON-encoded
     * @param [socketId] id of a socket that should not receive the event
     * @see RequestError
     */
    trigger(
        channels: string | Array<string>,
        event: string,
        data: any,
        socketId?: string
    ): Promise<Response> {
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
    }

    /* Triggers a batch of events
     *
     * @param An array of events, where Event is
     * {
     *   name: string,
     *   channel: string,
     *   data: any JSON-encodable data
     * }
     */
    triggerBatch(batch: Array<PusherT.BatchEvent>): Promise<Response> {
        return events.triggerBatch(this, batch);
    }

    notify() {
        this.notificationClient.notify.apply(this.notificationClient, arguments);
    }

    /** Makes a POST request to Pusher, handles the authentication.
     *
     * Returns a promise resolving to a response, or rejecting to a RequestError.
     *
     * @param options
     * @param options.path request path
     * @param options.params query params
     * @param options.body request body
     * @see RequestError
     */
    post(options: PusherT.PostOptions): Promise<Response> {
        return requests.send(this.config, Object.assign({}, options, { method: "POST" }));
    }

    /** Makes a GET request to Pusher, handles the authentication.
     *
     * Returns a promise resolving to a response, or rejecting to a RequestError.
     *
     * @param options
     * @param options.path request path
     * @param options.params query params
     * @see RequestError
     */
    get(options: PusherT.GetOptions): Promise<Response> {
        return requests.send(this.config, Object.assign({}, options, { method: "GET" }));
    }

    /** Creates a WebHook object for a given request.
     *
     * @param request
     * @param request.headers WebHook HTTP headers with lower-case keys
     * @param request.rawBody raw WebHook body
     * @returns
     */
    webhook(request: PusherT.WebHookRequest): WebHook {
        return new WebHook(this.config.token, request);
    }

    /** Builds a signed query string that can be used in a request to Pusher.
     *
     * @param options
     * @param options.method request method
     * @param options.path request path
     * @param options.params query params
     * @param options.body request body
     * @returns signed query string
     */
    createSignedQueryString(options: PusherT.SignedQueryStringOptions): string {
        return requests.createSignedQueryString(this.config.token, options);
    }

    channelSharedSecret(channel) {
        return createHash("sha256")
            .update(channel + this.config.encryptionMasterKey)
            .digest();
    }
}
export default Pusher;

