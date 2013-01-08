var https = require('https');
var http = require('http');
var parse = require('url').parse;
var log4js = require('log4js');

module.exports = function(url, headers, cb) {
    log4js.getLogger().debug('./get', url, headers);
    url = parse(url, false);
    var mod = http;
    var port = url.port || 80;
    if(url.protocol === 'https:') {
        mod = https;
        port = url.port || 443;
    }
    mod.request({
        hostname : url.hostname,
        port : port,
        method : 'GET',
        path : url.path,
        headers : headers
    }, function(res) {
        var body = new Buffer(0);
        res.on('data', function(buffer) {
            body = Buffer.concat([body, buffer]);
        });
        res.on('end', function() {
            if(cb) {
                cb(null, {
                    headers : res.headers,
                    body : body.toString('utf8')
                });
                cb = null;
            }
        });
    }).on('error', function(err) {
        if(cb) {
            cb(err);
            cb = null;
        }
    }).end();
};
