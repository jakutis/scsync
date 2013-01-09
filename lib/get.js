var request = require('./request');

module.exports = function(url, headers, cb) {
    request(url, 'GET', headers, function(res) {
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
    });
};
