var util = require('util');
var fs = require('fs');
var request = require('./request');

var todownload = 0;
var downloaded = 0;

module.exports = function(file, cb) {
    util.puts('begin ' + file.filename);
    todownload += 1;
    request(file.url, 'GET', {}, function(res) {
        request(res.headers.location, 'GET', {}, function(res) {
            res.on('error', cb);
            res.on('end', function() {
                downloaded += 1;
                util.puts('end ' + file.filename + ' (' + downloaded + ' of ' + todownload + ')');
                var time = Math.floor(file.date.getTime() / 1000);
                fs.utimes(file.filename, time, time, function() {
                    cb(null);
                });
            });
            res.pipe(fs.createWriteStream(file.filename));
        });
    });
};
