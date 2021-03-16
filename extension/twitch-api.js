"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.updateChannelInfo = exports.verifyTwitchDir = exports.refreshToken = void 0;
const express_1 = __importDefault(require("express"));
const needle_1 = __importDefault(require("needle"));
const events = __importStar(require("./util/events"));
const helpers_1 = require("./util/helpers");
const nodecg_1 = require("./util/nodecg");
const nodecg = nodecg_1.get();
const config = helpers_1.bundleConfig();
const app = express_1.default();
const apiData = nodecg.Replicant('twitchAPIData');
const channelInfo = nodecg.Replicant('twitchChannelInfo');
const commercialTimer = nodecg.Replicant('twitchCommercialTimer');
let channelInfoTO;
apiData.value.state = 'off'; // Set this to "off" on every start.
apiData.value.featuredChannels.length = 0; // Empty on every start.
/**
 * Logs out of the Twitch integration.
 */
function logout() {
    return __awaiter(this, void 0, void 0, function* () {
        if (apiData.value.state === 'off') {
            throw new Error('Integration not ready');
        }
        apiData.value = { state: 'off', sync: false, featuredChannels: [] };
        channelInfo.value = {};
        clearTimeout(channelInfoTO);
        nodecg.log.info('[Twitch] Integration successfully logged out');
    });
}
/**
 * Validate the currently stored token against the Twitch ID API.
 */
function validateToken() {
    return __awaiter(this, void 0, void 0, function* () {
        const resp = yield needle_1.default('get', 'https://id.twitch.tv/oauth2/validate', null, {
            headers: {
                Authorization: `OAuth ${apiData.value.accessToken}`,
            },
        });
        if (resp.statusCode !== 200) {
            throw new Error(JSON.stringify(resp.body));
            // Do we need to retry here?
        }
        return resp.body;
    });
}
/**
 * Refreshes the Twitch API access token, called whenever that is needed.
 */
function refreshToken() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            nodecg.log.info('[Twitch] Attempting to refresh access token');
            const resp = yield needle_1.default('post', 'https://id.twitch.tv/oauth2/token', {
                grant_type: 'refresh_token',
                refresh_token: encodeURI(apiData.value.refreshToken),
                client_id: config.twitch.clientID,
                client_secret: config.twitch.clientSecret,
            });
            if (resp.statusCode !== 200) {
                throw new Error(JSON.stringify(resp.body));
                // Do we need to retry here?
            }
            nodecg.log.info('[Twitch] Successfully refreshed access token');
            apiData.value.accessToken = resp.body.access_token;
            apiData.value.refreshToken = resp.body.refresh_token;
        }
        catch (err) {
            nodecg.log.warn('[Twitch] Error refreshing access token, you need to relogin');
            nodecg.log.debug('[Twitch] Error refreshing access token:', err);
            yield helpers_1.to(logout());
            throw err;
        }
    });
}
exports.refreshToken = refreshToken;
/**
 * Make a request to Twitch API.
 */
function request(method, endpoint, data = null, newAPI = false) {
    return __awaiter(this, void 0, void 0, function* () {
        const ep = `/${newAPI ? 'helix' : 'kraken'}${endpoint}`;
        try {
            nodecg.log.debug(`[Twitch] API ${method.toUpperCase()} request processing on ${ep}`);
            let retry = false;
            let attempts = 0;
            let resp;
            do {
                retry = false;
                attempts += 1;
                // eslint-disable-next-line no-await-in-loop
                resp = yield needle_1.default(method, `https://api.twitch.tv${ep}`, data, {
                    headers: {
                        Accept: !newAPI ? 'application/vnd.twitchtv.v5+json' : '',
                        'Content-Type': 'application/json',
                        Authorization: `${newAPI ? 'Bearer' : 'OAuth'} ${apiData.value.accessToken}`,
                        'Client-ID': config.twitch.clientID,
                    },
                });
                if (resp.statusCode === 401 && attempts <= 1) {
                    nodecg.log.debug(`[Twitch] API ${method.toUpperCase()} request `
                        + `resulted in ${resp.statusCode} on ${ep}:`, JSON.stringify(resp.body));
                    yield refreshToken(); // eslint-disable-line no-await-in-loop
                    retry = true;
                    // Can a 401 mean something else?
                }
                else if (resp.statusCode !== 200) {
                    throw new Error(JSON.stringify(resp.body));
                    // Do we need to retry here?
                }
            } while (retry);
            nodecg.log.debug(`[Twitch] API ${method.toUpperCase()} request successful on ${ep}`);
            return resp;
        }
        catch (err) {
            nodecg.log.debug(`[Twitch] API ${method.toUpperCase()} request error on ${ep}:`, err);
            throw err;
        }
    });
}
/**
 * Gets the channel's information and stores it in a replicant every 60 seconds.
 */
function refreshChannelInfo() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const resp = yield request('get', `/channels/${apiData.value.channelID}`);
            if (resp.statusCode !== 200) {
                throw new Error(JSON.stringify(resp.body));
            }
            channelInfo.value = resp.body;
            channelInfoTO = setTimeout(refreshChannelInfo, 60 * 1000);
        }
        catch (err) {
            // Try again after 10 seconds.
            nodecg.log.warn('[Twitch] Error getting channel information');
            nodecg.log.debug('[Twitch] Error getting channel information:', err);
            channelInfoTO = setTimeout(refreshChannelInfo, 10 * 1000);
        }
    });
}
/**
 * Returns the correct name of a game in the Twitch directory based on a search.
 * @param query String you wish to try to find a game with.
 */
function searchForGame(query) {
    return __awaiter(this, void 0, void 0, function* () {
        if (apiData.value.state !== 'on') {
            throw new Error('Integration not ready');
        }
        const resp = yield request('get', `/search/games?query=${encodeURIComponent(query)}`);
        if (resp.statusCode !== 200) {
            throw new Error(JSON.stringify(resp.body));
        }
        else if (!resp.body.games || !resp.body.games.length) {
            throw new Error(`No game matches for "${query}"`);
        }
        const results = resp.body.games;
        const exact = results.find((game) => game.name.toLowerCase() === query.toLowerCase());
        return (exact) ? exact.name : results[0].name;
    });
}
/**
 * Verify a Twitch directory exists and get the correct name if so.
 * Will return undefined if it cannot.
 * @param query String to use to find/verify the directory.
 */
function verifyTwitchDir(query) {
    return __awaiter(this, void 0, void 0, function* () {
        const [, game] = yield helpers_1.to(searchForGame(query));
        return game;
    });
}
exports.verifyTwitchDir = verifyTwitchDir;
/**
 * Attempts to update the title/game on the set channel.
 * @param status Title to set.
 * @param game Game to set.
 */
function updateChannelInfo(status, game) {
    return __awaiter(this, void 0, void 0, function* () {
        if (apiData.value.state !== 'on') {
            throw new Error('Integration not ready');
        }
        try {
            nodecg.log.info('[Twitch] Attempting to update channel information');
            const [, dir] = (game) ? yield helpers_1.to(verifyTwitchDir(game)) : [null, undefined];
            const resp = yield request('put', `/channels/${apiData.value.channelID}`, {
                channel: {
                    status: (status) ? status.slice(0, 140) : undefined,
                    game: dir || helpers_1.bundleConfig().twitch.streamDefaultGame,
                },
            });
            if (resp.statusCode !== 200) {
                throw new Error(JSON.stringify(resp.body));
            }
            nodecg.log.info('[Twitch] Successfully updated channel information');
            channelInfo.value = resp.body;
            return !dir;
        }
        catch (err) {
            nodecg.log.warn('[Twitch] Error updating channel information');
            nodecg.log.debug('[Twitch] Error updating channel information:', err);
            throw err;
        }
    });
}
exports.updateChannelInfo = updateChannelInfo;
/**
 * Triggered when a commercial is started, and runs every second
 * until it has assumed to have ended, to update the relevant replicant.
 * We also do this during setup, in case there was one running when the app closed.
 */
function updateCommercialTimer() {
    const timer = commercialTimer.value;
    const remaining = timer.originalDuration - ((Date.now() - timer.timestamp) / 1000);
    if (remaining > 0) {
        commercialTimer.value.secondsRemaining = Math.round(remaining);
        setTimeout(updateCommercialTimer, 1000);
    }
    else {
        commercialTimer.value.secondsRemaining = 0;
    }
}
/**
 * Attempts to start a commercial on the set channel.
 */
function startCommercial(duration) {
    return __awaiter(this, void 0, void 0, function* () {
        if (apiData.value.state !== 'on') {
            throw new Error('Integration not ready');
        }
        try {
            const dur = duration && typeof duration === 'number'
                && [30, 60, 90, 120, 150, 180].includes(duration) ? duration : 180;
            nodecg.log.info('[Twitch] Requested a commercial to be started');
            const resp = yield request('post', `/channels/${apiData.value.channelID}/commercial`, {
                length: dur,
            });
            if (resp.statusCode !== 200) {
                throw new Error(JSON.stringify(resp.body));
            }
            // Update commercial timer values, trigger check logic.
            commercialTimer.value.originalDuration = dur;
            commercialTimer.value.secondsRemaining = dur;
            commercialTimer.value.timestamp = Date.now();
            updateCommercialTimer();
            nodecg.log.info(`[Twitch] Commercial started successfully (${dur} seconds)`);
            nodecg.sendMessage('twitchCommercialStarted', { duration: dur });
            nodecg.sendMessage('twitchAdStarted', { duration: dur }); // Legacy
            helpers_1.to(events.sendMessage('twitchCommercialStarted', { duration: dur }));
            return { duration: dur };
        }
        catch (err) {
            nodecg.log.warn('[Twitch] Error starting commercial');
            nodecg.log.debug('[Twitch] Error starting commercial:', err);
            throw err;
        }
    });
}
/**
 * Setup done on both server boot (if token available) and initial auth flow.
 */
function setUp() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!config.twitch.channelName) {
            let [err, resp] = yield helpers_1.to(validateToken());
            if (err) {
                yield refreshToken();
                [err, resp] = yield helpers_1.to(validateToken());
            }
            if (!resp) {
                throw new Error('No response while validating token');
            }
            apiData.value.channelID = resp.user_id;
            apiData.value.channelName = resp.login;
        }
        else {
            const resp = yield request('get', `/users?login=${config.twitch.channelName}`);
            if (!resp.body.users.length) {
                throw new Error('channelName specified in the configuration not found');
            }
            apiData.value.channelID = resp.body.users[0]._id; // eslint-disable-line no-underscore-dangle
            apiData.value.channelName = resp.body.users[0].name;
        }
        clearTimeout(channelInfoTO);
        apiData.value.state = 'on';
        refreshChannelInfo();
        updateCommercialTimer();
    });
}
if (config.twitch.enabled) {
    nodecg.log.info('[Twitch] Integration enabled');
    // Listen for logout command from button on dashboard.
    nodecg.listenFor('twitchLogout', (data, ack) => {
        logout()
            .then(() => helpers_1.processAck(ack, null))
            .catch((err) => helpers_1.processAck(ack, err));
    });
    // If we already have an access token stored, verify it.
    if (apiData.value.accessToken) {
        apiData.value.state = 'authenticating';
        setUp().then(() => {
            nodecg.log.info('[Twitch] Integration ready');
        }).catch((err) => {
            nodecg.log.warn('[Twitch] Issue activating integration: ', err);
            helpers_1.to(logout());
        });
    }
    // Route that receives Twitch's auth code when the user does the flow from the dashboard.
    app.get('/nodecg-speedcontrol/twitchauth', (req, res) => {
        apiData.value.state = 'authenticating';
        needle_1.default('post', 'https://id.twitch.tv/oauth2/token', {
            client_id: config.twitch.clientID,
            client_secret: config.twitch.clientSecret,
            code: req.query.code,
            grant_type: 'authorization_code',
            redirect_uri: config.twitch.redirectURI,
        }).then((resp) => {
            apiData.value.accessToken = resp.body.access_token;
            apiData.value.refreshToken = resp.body.refresh_token;
            setUp().then(() => {
                nodecg.log.info('[Twitch] Authentication successful');
                res.send('<b>Twitch authentication is now complete, '
                    + 'feel free to close this window/tab.</b>');
            }).catch(() => {
                throw new Error();
            });
        }).catch(() => {
            nodecg.log.warn('[Twitch] Issue with authentication');
            helpers_1.to(logout());
            res.send('<b>Error while processing the Twitch authentication, please try again.</b>');
        });
    });
    nodecg.mount(app);
}
// NodeCG messaging system.
nodecg.listenFor('twitchUpdateChannelInfo', (data, ack) => {
    updateChannelInfo(data.status, data.game)
        .then((noTwitchGame) => helpers_1.processAck(ack, null, noTwitchGame))
        .catch((err) => helpers_1.processAck(ack, err));
});
nodecg.listenFor('twitchStartCommercial', (data, ack) => {
    startCommercial(data.duration)
        .then(() => helpers_1.processAck(ack, null))
        .catch((err) => helpers_1.processAck(ack, err));
});
nodecg.listenFor('playTwitchAd', (data, ack) => {
    startCommercial(data.duration)
        .then(() => helpers_1.processAck(ack, null))
        .catch((err) => helpers_1.processAck(ack, err));
});
nodecg.listenFor('twitchAPIRequest', (data, ack) => {
    request(data.method, data.endpoint, data.data, data.newAPI)
        .then((resp) => helpers_1.processAck(ack, null, resp))
        .catch((err) => helpers_1.processAck(ack, err));
});
// Our messaging system.
events.listenFor('twitchUpdateChannelInfo', (data, ack) => {
    updateChannelInfo(data.status, data.game)
        .then((noTwitchGame) => {
        helpers_1.processAck(ack, null, noTwitchGame);
        if (noTwitchGame) {
            nodecg.sendMessage('triggerAlert', 'NoTwitchGame');
        }
    })
        .catch((err) => helpers_1.processAck(ack, err));
});
events.listenFor('twitchStartCommercial', (data, ack) => {
    startCommercial(data.duration)
        .then(() => helpers_1.processAck(ack, null))
        .catch((err) => helpers_1.processAck(ack, err));
});
events.listenFor('twitchAPIRequest', (data, ack) => {
    request(data.method, data.endpoint, data.data, data.newAPI)
        .then((resp) => helpers_1.processAck(ack, null, resp))
        .catch((err) => helpers_1.processAck(ack, err));
});
