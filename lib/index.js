'use strict';

let util = require('util');
let redis = require('redis');
let Promise = require('bluebird');
let debug = require('debug')('redis-hook');
let strategist = require('strategist')({
    validator: 'ajv'
});

strategist.set('redis', {
    "title": "Validate Redis Connection Options",
    "type": "object",
    "properties": {
        "host": {
            "description": "The IP of your Redis server.",
            "type": "string",
            "pattern": "^(localhost|(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))$",
            "default": "127.0.0.1"
        },
        "port": {
            "description": "The port Redis is listening on.",
            "type": "integer",
            "minimum": 0,
            "maximum": 65535,
            "exclusiveMaximum": false,
            "default": 6379
        },
        "path": {
            "description": "The Unix socket string to connect to.",
            "type": "string",
            "pattern": "^(/[^/ ]*)+/?$"
        },
        "url": {
            "description": "The redis url to connect to ([redis:]//[user][:password@][host][:port][/db-number][?db=db-number[&password=bar[&option=value]]]. See: http://www.iana.org/assignments/uri-schemes/prov/redis.",
            "type": "string"
        },
        "parser": {
            "description": "Which Redis protocol reply parser to use.",
            "type": "string",
            "default": "hiredis"
        },
        "return_buffers": {
            "description": "If set to true, then all replies will be sent to callbacks as Buffers instead of Strings.",
            "type": "boolean",
            "default": false
        },
        "detect_buffers": {
            "description": "If set to true, then replies will be sent to callbacks as Buffers. Please be aware that this can't work properly with the pubsub mode. A subscriber has to either always return strings or buffers. if any of the input arguments to the original command were Buffers. This option lets you switch between Buffers and Strings on a per-command basis, whereas return_buffers applies to every command on a client.",
            "type": "boolean",
            "default": false
        },
        "socket_keepalive": {
            "description": "Whether the keep-alive functionality is enabled on the underlying socket.",
            "type": "boolean",
            "default": true
        },
        "no_ready_check": {
            "description": "When a connection is established to the Redis server, the server might still be loading the database from disk. While loading the server will not respond to any commands. To work around this, node_redis has a 'ready check' which sends the INFO command to the server. The response from the INFO command indicates whether the server is ready for more commands. When ready, node_redis emits a ready event. Setting no_ready_check to true will inhibit this check.",
            "type": "boolean",
            "default": false
        },
        "enable_offline_queue": {
            "description": "By default, if there is no active connection to the redis server, commands are added to a queue and are executed once the connection has been established. Setting enable_offline_queue to false will disable this feature and the callback will be executed immediately with an error, or an error will be emitted if no callback is specified.",
            "type": "boolean",
            "default": true
        },
        "connect_timeout": {
            "description": "Setting connect_timeout limits total time for client to connect and reconnect. The value is provided in milliseconds and is counted from the moment on a new client is created / a connection is lost. The last retry is going to happen exactly at the timeout time. Default is to try connecting until the default system socket timeout has been exceeded and to try reconnecting until 1h passed.",
            "type": "integer",
            "default": 3600000
        },
        "retry_unfulfilled_commands": {
            "description": "If set to true, all commands that were unfulfulled while the connection is lost will be retried after the connection has reestablished again. Use this with caution, if you use state altering commands (e.g. incr). This is especially useful if you use blocking commands.",
            "type": "boolean",
            "default": false
        },
        "password": {
            "description": "If set, client will run redis auth command on connect.",
            "type": "string",
            "default": undefined
        },
        "family": {
            "description": "You can force using IPv6 if you set the family to 'IPv6'. See Node.js net or dns modules how to use the family type.",
            "type": "string",
            "default": "IPv4"
        },
        "disable_resubscribing": {
            "description": "If set to true, a client won't resubscribe after disconnecting.",
            "type": "boolean",
            "default": false
        },
        "rename_commands": {
            "description": "Pass a object with renamed commands to use those instead of the original functions. See http://redis.io/topics/security for more info.",
            "type": "object",
            "default": false
        },
        "tls": {
            "description": "An object containing options to pass to tls.connect, to set up a TLS connection to Redis (if, for example, it is set up to be accessible via a tunnel).",
            "type": "object",
            "default": null
        },
        "prefix": {
            "description": "Pass a string to prefix all used keys with e.g. 'namespace:test'.",
            "type": "string",
            "default": null
        },

        // These are internal to this module
        //
        "promisify": {
            "description": "Whether to return a promisified Redis interface",
            "type": "boolean",
            "default": true
        }
    }
});

// Will validate configuration object and return a Redis client if possible.
//
// @param opts {Object} This should contain configuration settings that
//                      conform to the schema above.
//
module.exports = function(opts) {

    let optsCheck = strategist.validate('redis', opts);

    if(!optsCheck.valid) {
        throw new Error(util.inspect(optsCheck.errors, {depth:10}))
    }

    // #retry_strategy is a function, which cannot be verified using the schema
    //
    opts.retry_strategy = typeof opts.retry_strategy === 'function' ? opts.retryStrategy : false;

    // Merge validated options into redis schema defaults.
    //
    let args = Object.assign(strategist.defaults('redis'), opts);

    if(args.promisify) {

        // https://github.com/NodeRedis/node_redis#promises
        //
        Promise.promisifyAll(redis.RedisClient.prototype);
        Promise.promisifyAll(redis.Multi.prototype);
    }

    debug('Sending:', args);

    let port = args.port;
    let url = args.url;
    let host = args.host;
    let password = args.password;

    let client = redis.createClient(port, url || host, args);

    if(password) {
        client
            .authAsync(password)
            .catch(err => {
                throw new Error('Cannot authenticate with given password');
            });
    }

    // While the connection & auth w/ Redis is asynchronous, pre-connected commands
    // are queued by the library and replayed when connection is made.
    // https://github.com/NodeRedis/node_redis#ready
    //
    return client;
};
