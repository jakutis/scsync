var get = require('./get');
var parse = require('url').parse;

var makeHeaders = function(referrer) {
    return {
        'Referrer': referrer,
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0',
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.97 Safari/537.11',
        'Accept': '*/*',
        'Accept-Encoding': '',
        'Accept-Language': 'en-US,en;q=0.8',
        'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3'
    };
};

var clientIdFromJS = function(js, cb) {
    var i = js.indexOf('\ndefine("config"');
    if(i < 0) {
        cb(new Error('javascript source code structure changed'));
    } else {
        var left = ',g="';
        i = js.indexOf(left, i);
        if(i < 0) {
            cb(new Error('javascript source code structure changed'));
        } else {
            js = js.substr(i + left.length);
            cb(null, js.substr(0, js.indexOf('"')));
        }
    }
};

var clientIdFromHTML = function(html, cb) {
    var i = html.indexOf('https://a2.sndcdn.com/assets/sc-');
    if(i < 0) {
        cb(new Error('html structure changed'));
    } else {
        html = html.substr(i);
        get(html.substr(0, html.indexOf('">')), makeHeaders('https://soundcloud.com/'), function(err, resp) {
            if(err) {
                cb(err);
            } else {
                clientIdFromJS(resp.body, cb);
            }
        });
    }
};

module.exports = {
    trackId : function(track, clientId, cb) {
        get('https://api.sndcdn.com/resolve?url=https%3A//soundcloud.com/' + track + '&_status_code_map%5B302%5D=200&_status_format=json&client_id=' + clientId, makeHeaders('https://soundcloud.com/'), function(err, resp) {
            if(err) {
                cb(err);
            } else {
                var url = parse(resp.headers.location, true);
                cb(null, url.pathname.split('/')[2]);
            }
        });
    },
    artistId : function(artistHandle, clientId, cb) {
        get('https://api.sndcdn.com/resolve?url=https%3A//soundcloud.com/' + artistHandle + '&_status_code_map%5B302%5D=200&_status_format=json&client_id=' + clientId, makeHeaders('https://soundcloud.com/'), function(err, resp) {
            if(err) {
                cb(err);
            } else {
                var url = parse(resp.headers.location, true);
                cb(null, url.pathname.split('/')[2]);
            }
        });
    },
    clientId : function(cb) {
        get('https://soundcloud.com', makeHeaders(null), function(err, resp) {
            if(err) {
                cb(err);
            } else {
                clientIdFromHTML(resp.body, cb);
            }
        });
    }
};
