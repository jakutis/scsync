var util = require('util');
var v = require('valentine');
var resolveStream = require('./resolve');
var fs = require('fs');
var evaluate = require('./evaluate');
var a = require('async');
var api = require('./api');
var extractNewFiles = function(found, now, opts, cb) {
    var process = function(files) {
    v.each(files, function(file) {
        var vars = {
            a : file.artist,
            t : file.title,
            y : file.date.getFullYear().toString(),
            m : file.date.getMonth() + 1,
            d : file.date.getDate()
        };
        vars.m = vars.m < 10 ? '0' + vars.m : vars.m.toString();
        vars.d = vars.d < 10 ? '0' + vars.d : vars.d.toString();
        file.filename = opts.directory + '/' + evaluate(vars, opts.format);
    });
    files = v.filter(files, function(file) {
        if(typeof found[file.filename] === 'undefined') {
            found[file.filename] = true;
            return true;
        }
        return false;
    });
    if(opts.debug) {
        util.puts('found new tracks in page: ' + files.length);
    }
    a.mapSeries(files, function(file, cb) {
        resolveStream(opts.debug, file, function(err, resolvedFile) {
            if(err) {
                util.puts('Failed to resolve ' + file.filename + ': ' + err.stack);
                cb(null, null);
            } else {
                cb(null, resolvedFile);
            }
        });
    }, function(err, files) {
        if(err) {
            cb(err, null);
            return;
        }
        a.reject(files, function(file, cb) {
            if(file === null) {
                cb(true);
            } else {
                fs.exists(file.filename, cb);
            }
        }, function(files) {
            if(opts.debug) {
                util.puts('found not downloaded tracks in page: ' + files.length);
            }
            cb(null, files);
        });
    });
    };
    api.clientId(function(err, id) {
        if(err) {
            cb(err);
            return;
        }
        api.artistId(opts.artist, id, function(err, artistId) {
            if(err) {
                cb(err);
                return;
            }
            api.artistTracks(artistId, id, opts.streamed, function(err, artistTracks) {
                if(err) {
                    cb(err);
                    return;
                }
                process(artistTracks);
            });
        });
    });
};
module.exports = function(now, opts, cb) {
    var foundFilenames = {};
    extractNewFiles(foundFilenames, now, opts, function(err, currentFiles) {
        cb(err, currentFiles, null);
    });
};
