var request = require('./request');
var util = require('util');
var gid = 0;
var getSuffix = require('./suffix');
module.exports = function(debug, file, cb1) {
    var id = gid;
    gid += 1;
    if(debug) {
        util.puts('resolveStream start: ' + id + ' ' + file.filename);
    }
    var cb = function(err, resolvedFile) {
        if(debug) {
            if(err) {
                util.puts('resolveStream fail: ' + id + ' ' + file.filename);
            } else {
                util.puts('resolveStream finish: ' + id + ' ' + resolvedFile.filename);
            }
        }
        cb1(err, resolvedFile);
    };
    try {
        request(file.url, 'GET', {}, function(res) {
            if(debug) {
                util.puts('resolveStream progress: ' + id + ' ' + res.headers.location);
            }
            if(typeof res.headers.location === 'undefined') {
                cb(new Error('Location header not found'));
                return;
            }
            try {
                request(res.headers.location, 'GET', {}, function(res) {
                    try {
                        res.destroy();
                        cb(null, {
                            date : file.date,
                            url : file.url,
                            filename : file.filename + getSuffix(res.headers)
                        });
                    } catch(err) {
                        cb(err, null);
                    }
                }).on('close', function() {
                    if(debug) {
                        util.puts('resolveStream close: ' + id + ' ' + JSON.stringify(arguments));
                    }
                }).on('end', function() {
                    if(debug) {
                        util.puts('resolveStream end: ' + id + ' ' + JSON.stringify(arguments));
                    }
                }).on('error', function(err) {
                    cb(err, null);
                });
            } catch(err) {
                cb(err, null);
            }
        }).on('error', function(err) {
            cb(err, null);
        });
    } catch(err) {
        cb(err, null);
    }
};

