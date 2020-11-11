/** Contains information about an HTTP request error.
 *
 * @constructor
 * @extends Error
 * @param {String} message error message
 * @param {String} url request URL
 * @param [error] optional error cause
 * @param {Number} [status] response status code, if received
 * @param {String} [body] response body, if received
 */
class RequestError extends Error {
 constructor(message, url, error, status, body) {
     this.name = "PusherRequestError";
     this.stack = new Error().stack;
     /** @member {String} error message */
     this.message = message;
     /** @member {String} request URL */
     this.url = url;
     /** @member optional error cause */
     this.error = error;
     /** @member {Number} response status code, if received */
     this.status = status;
     /** @member {String} response body, if received */
     this.body = body;
 }
}

/** Contains information about a WebHook error.
 *
 * @constructor
 * @extends Error
 * @param {String} message error message
 * @param {String} contentType WebHook content type
 * @param {String} body WebHook body
 * @param {String} signature WebHook signature
 */
class WebHookError extends Error {
 constructor(message, contentType, body, signature) {
     this.name = "PusherWebHookError";
     this.stack = new Error().stack;
     /** @member {String} error message */
     this.message = message;
     /** @member {String} WebHook content type */
     this.contentType = contentType;
     /** @member {String} WebHook body */
     this.body = body;
     /** @member {String} WebHook signature */
     this.signature = signature;
 }
}

export { RequestError };
export { WebHookError };
