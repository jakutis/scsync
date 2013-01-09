var https = require('https');
var http = require('http');
var parse = require('url').parse;

module.exports = function(url, method, headers, cb) {
    url = parse(url, false);
    var mod = http;
    var port = url.port || 80;
    if(url.protocol === 'https:') {
        mod = https;
        port = url.port || 443;
    }
    var req = mod.request({
        hostname : url.hostname,
        port : port,
        method : method,
        path : url.path,
        headers : headers
    }, cb);
    req.end();
    return req;
};
