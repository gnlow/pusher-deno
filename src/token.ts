import { hmac } from "https://denopkg.com/chiefbiiko/hmac/mod.ts";
import * as util from "./util.js";

/** Verifies and signs data against the key and secret.
 *
 * @constructor
 * @param {String} key app key
 * @param {String} secret app secret
 */
class Token {
	public key: any;
	public secret: any;

 constructor(key, secret) {
     this.key = key;
     this.secret = secret;
 }

 /** Signs the string using the secret.
  *
  * @param {String} string
  * @returns {String}
  */
 sign(string) {
     return hmac("sha256", this.secret, string, "utf8", "hex")
 }

 /** Checks if the string has correct signature.
  *
  * @param {String} string
  * @param {String} signature
  * @returns {Boolean}
  */
 verify(string, signature) {
     return util.secureCompare(this.sign(string), signature);
 }
}

export default Token;
