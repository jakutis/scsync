var util = require('util');
var fs = require('fs');
var http = require('http');

var todownload = 0;
var downloaded = 0;

module.exports = function(file, cb) {
    util.puts('begin ' + file.filename);
    todownload += 1;
    http.get(file.url, function(res) {
        http.get(res.headers.location, function(res) {
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
