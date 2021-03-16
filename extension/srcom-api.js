"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchForUserDataMultiple = exports.searchForUserData = exports.searchForTwitchGame = void 0;
const needle_1 = __importDefault(require("needle"));
const nodecg_1 = require("./util/nodecg");
const nodecg = nodecg_1.get();
const userDataCache = {};
/**
 * Make a GET request to speedrun.com API.
 * @param url speedrun.com API endpoint you want to access.
 */
function get(endpoint) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            nodecg.log.debug(`[speedrun.com] API request processing on ${endpoint}`);
            const resp = yield needle_1.default('get', `https://www.speedrun.com/api/v1${endpoint}`, null, {
                headers: {
                    'User-Agent': 'nodecg-speedcontrol',
                    Accept: 'application/json',
                },
            });
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore: parser exists but isn't in the typings
            if (resp.parser !== 'json') {
                throw new Error('Response was not JSON');
                // We should retry here.
            }
            else if (resp.statusCode !== 200) {
                throw new Error(JSON.stringify(resp.body));
                // Do we need to retry here? Depends on err code.
            }
            nodecg.log.debug(`[speedrun.com] API request successful on ${endpoint}`);
            return resp;
        }
        catch (err) {
            nodecg.log.debug(`[speedrun.com] API request error on ${endpoint}:`, err);
            throw err;
        }
    });
}
/**
 * Returns the Twitch game name if set on speedrun.com.
 * @param query String you wish to try to find a game with.
 */
function searchForTwitchGame(query, abbr = false) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const endpoint = (abbr) ? 'abbreviation' : 'name';
            const resp = yield get(`/games?${endpoint}=${encodeURIComponent(query)}&max=1`);
            if (!resp.body.data.length) {
                throw new Error('No game matches');
            }
            else if (!resp.body.data[0].names.twitch) {
                throw new Error('Game was found but has no Twitch game set');
            }
            nodecg.log.debug(`[speedrun.com] Twitch game name found for "${query}":`, resp.body.data[0].names.twitch);
            return resp.body.data[0].names.twitch;
        }
        catch (err) {
            nodecg.log.debug(`[speedrun.com] Twitch game name lookup failed for "${query}":`, err);
            throw err;
        }
    });
}
exports.searchForTwitchGame = searchForTwitchGame;
/**
 * Returns the user's data if available on speedrun.com.
 * @param query String you wish to try to find a user with.
 */
function searchForUserData(query) {
    return __awaiter(this, void 0, void 0, function* () {
        if (userDataCache[query]) {
            nodecg.log.debug(`[speedrun.com] User data found in cache for "${query}":`, JSON.stringify(userDataCache[query]));
            return userDataCache[query];
        }
        try {
            const resp = yield get(`/users?lookup=${encodeURIComponent(query)}&max=1`);
            if (!resp.body.data.length) {
                throw new Error(`No user matches for "${query}"`);
            }
            [userDataCache[query]] = resp.body.data; // Simple temp cache storage.
            nodecg.log.debug(`[speedrun.com] User data found for "${query}":`, JSON.stringify(resp.body.data[0]));
            return resp.body.data[0];
        }
        catch (err) {
            nodecg.log.debug(`[speedrun.com] User data lookup failed for "${query}":`, err);
            throw err;
        }
    });
}
exports.searchForUserData = searchForUserData;
/**
 * Try to find user data using multiple strings, will loop through them until one is successful.
 * Does not return any errors, if those happen this will just treat it as unsuccessful.
 * @param queries List of queries to use, if any are falsey they will be skipped.
 */
function searchForUserDataMultiple(...queries) {
    return __awaiter(this, void 0, void 0, function* () {
        let userData;
        for (const query of queries) {
            if (query) {
                try {
                    const data = yield searchForUserData(query);
                    userData = data;
                    break;
                }
                catch (err) {
                    // nothing found
                }
            }
        }
        return userData;
    });
}
exports.searchForUserDataMultiple = searchForUserDataMultiple;
