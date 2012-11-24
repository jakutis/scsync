var util = require('util');
var download = require('./download');
var v = require('valentine');
var a = require('async');
var vt = require('vague-time');
var list = require('./list');

module.exports = function(opts) {
    var now = new Date().getTime();
    util.puts('maxTracks: ' + opts.maxTracks);
    util.puts('gap: ' + vt.get({ from : Math.floor((now - opts.gap) / 1000), to : Math.floor(now / 1000)}) + ' (' + opts.gap + ' milliseconds)');
    var files = [];
    var check = function() {
        if(files.length === 0) {
            util.puts('nothing to download.');
            process.exit();
            return;
        }
    };
    var compareFilesDate = function(a, b) {
        return b.date.getTime() - a.date.getTime();
    };
    list(now, opts, function(err, newFiles, more) {
        if(err) {
            throw err;
        }
        files.push.apply(files, newFiles);
        files.sort(compareFilesDate);
        if(more === null || files.length >= opts.maxTracks || v.every(newFiles, function(file) {
            return now - file.date.getTime() > opts.gap;
        })) {
            check();
            if(files.length > opts.maxTracks) {
                files = files.slice(0, opts.maxTracks);
            }
            check();
            if((now - files[files.length - 1].date.getTime()) > opts.gap) {
                if(opts.debug) {
                    util.puts('okey, trimming by gap');
                }
                var first = -1;
                v.some(files, function(file, i) {
                    if((now - file.date.getTime()) > opts.gap) {
                        first = i;
                        return true;
                    }
                });
                if(opts.debug) {
                    util.puts('the first track to reject is ' + JSON.stringify(files[first]));
                }
                if(first >= 0) {
                    files = files.slice(0, first);
                }
            }
            check();
            util.puts('downloading ' + files.length + ' tracks.');
            util.puts('the first was uploaded at ' + files[0].date);
            util.puts('the last was uploaded at ' + files[files.length - 1].date);
            a.forEach(files, download, function(err) {
                if(err) {
                    throw err;
                }
                util.puts('done.');
                process.exit();
            });
        } else {
            more();
        }
    });
};
