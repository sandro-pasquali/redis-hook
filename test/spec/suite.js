"use strict";

let util = require('util');
let _ = require('lodash');
let inst = require('../../lib');

// Adds tests to sent promise that attempt to initialize module with
// invalid schema values, adding proper handlers, etc.
// Returns extended promise
//
// @param prom {Promise}    A promise
// @param test {Objet}  The testing object that @tape returns (see @surveyor)
//
function addSchemaTests(prom, test) {

    let schemaOpts = {

        'host' : '0.0.0.0.0', // invalid ip
        'port' : 1000000, // out of range integer
        'path' : 123, // should be a string
        'url' : 123, // should be string
        'string_numbers' : 123, // should be boolean
        'return_buffers' : 123, // should be boolean
        'detect_buffers' : 123, // should be boolean
        'socket_keepalive' : 123, // should be boolean
        'no_ready_check' : 123, // should be boolean
        'enable_offline_queue' : 123, // should be boolean
        'connect_timeout' : 'abc', // should be integer
        'retry_unfulfilled_commands' : 123, // should be boolean
        'password' : 123, // should be a string
        'family' : 123, // should be a string
        'disable_resubscribing' : 123, // should be boolean
        'rename_commands' : 123, // should be object
        'tls' : 123, // should be object
        'prefix' : 123, // should be string

        'promisify' : 123 // should be boolean
    };

    Object.keys(schemaOpts).forEach(function(key) {

        prom
            .then(() => {
                let obj = {};
                obj[key] = schemaOpts[key];
                return Promise.resolve(inst(obj));
            })
            .then(() => {
                test.fail('Did not throw with invalid schema value for #' + key);
            })
            .catch(() => {
                test.pass('Correctly caught invalid schema value for #' + key);
            })
    });

    return prom;
}


module.exports = function(test, Promise) {

    let redis = inst({
        host: 'localhost'
    });

    return addSchemaTests(Promise.resolve(), test)
        .then(() => redis.infoAsync())
        .then(info => test.ok(info, 'Able to run #info command on Redis DB'))
        .catch(err => test.fail('General testing error: ' + err))
        .finally(() => redis.quit());
};