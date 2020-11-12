import type { PusherT } from "./types.ts"

import * as errors from "./errors.ts";

/** Provides validation and access methods for a WebHook.
 *
 * Before accessing WebHook data, check if it's valid. Otherwise, exceptions
 * will be raised from access methods.
 *
 * @constructor
 * @param primary token
 * @param request
 * @param request.headers WebHook HTTP headers with lower-case keys
 * @param request.rawBody raw WebHook body
 */
class WebHook {
	public token: any;
	public key: any;
	public signature: any;
	public contentType: any;
	public body: any;
	public data: any;

    constructor(token: PusherT.Token, request: PusherT.WebHookRequest) {
        this.token = token;
        this.key = request.headers["x-pusher-key"];
        this.signature = request.headers["x-pusher-signature"];
        this.contentType = request.headers["content-type"];
        this.body = request.rawBody;
        if (this.isContentTypeValid()) {
            try {
                // Try to parse as JSON
                this.data = JSON.parse(this.body);
            }
            catch (e) {
                // Do nothing
            }
        }
    }

    /** Checks whether the WebHook has valid body and signature.
     *
     * @param list of additional tokens to be validated against
     */
    isValid(extraTokens?: PusherT.Token | Array<PusherT.Token>): boolean {
        if (!this.isBodyValid()) {
            return false;
        }
        extraTokens = extraTokens || [];
        if (!(extraTokens instanceof Array)) {
            extraTokens = [extraTokens];
        }
        const tokens = [this.token].concat(extraTokens);
        for (const i in tokens) {
            const token = tokens[i];
            if (this.key == token.key && token.verify(this.body, this.signature)) {
                return true;
            }
        }
        return false;
    }

    /** Checks whether the WebHook content type is valid.
     *
     * For now, the only valid WebHooks have content type of application/json.
     */
    isContentTypeValid(): boolean {
        return this.contentType === "application/json";
    }

    /** Checks whether the WebHook content type and body is JSON.
     *
     * @returns
     */
    isBodyValid(): boolean {
        return this.data !== undefined;
    }

    /** Returns all WebHook data.
     *
     * @throws WebHookError when WebHook is invalid
     */
    getData(): PusherT.WebHookData {
        if (!this.isBodyValid()) {
            throw new errors.WebHookError("Invalid WebHook body", this.contentType, this.body, this.signature);
        }
        return this.data;
    }

    /** Returns WebHook events array.
     *
     * @throws WebHookError when WebHook is invalid
     */
    getEvents(): Array<PusherT.Event> {
        return this.getData().events;
    }

    /** Returns WebHook timestamp.
     *
     * @throws WebHookError when WebHook is invalid
     */
    getTime(): Date {
        return new Date(this.getData().time_ms);
    }
}

export default WebHook;
