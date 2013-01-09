var get = require('./get');
var a = require('async');
var util = require('util');
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

var resolvableId = function(resource, clientId, cb) {
    get('https://api.sndcdn.com/resolve?url=https%3A//soundcloud.com/' + resource + '&_status_code_map%5B302%5D=200&_status_format=json&client_id=' + clientId, makeHeaders('https://soundcloud.com/'), function(err, resp) {
        if(err) {
            cb(err);
        } else {
            var url = parse(resp.headers.location, true);
            cb(null, url.pathname.split('/')[2]);
        }
    });
};

var trackDownloadURL = function(trackId, clientId, cb) {
    cb(null, 'https://api.soundcloud.com/tracks/' + trackId + '/download?client_id=' + clientId);
};

module.exports = {
    trackId : resolvableId,
    artistId : resolvableId,
    artistTracks : function(artistId, clientId, forceStreamed, cb) {
        var self = this;
        get('http://api.soundcloud.com/users/' + artistId + '/tracks.json?client_id=' + clientId, makeHeaders('https://soundcloud.com'), function(err, resp) {
            if(err) {
                cb(err);
            } else {
                resp = JSON.parse(resp.body);
                var tracks = [];
                for(var i = 0; i < resp.length; i += 1) {
                    var track = resp[i];
                    if(track.kind === 'track') {
                        tracks.push(track);
                    }
                }
                a.map(tracks, function(track, cb) {
                    var cb2 = function(err, url) {
                        if(err) {
                            cb(err);
                        } else {
                            cb(null, {
                                artist : track.user.permalink,
                                title : track.permalink,
                                date : new Date(track.created_at),
                                url : url
                            });
                        }
                    };
                    if(track.downloadable && !forceStreamed) {
                        cb2(null, 'https://api.soundcloud.com/tracks/' + track.id + '/download?client_id=' + clientId);
                    } else {
                        cb2(null, 'https://api.soundcloud.com/tracks/' + track.id + '/stream?client_id=' + clientId);
                    }
                }, cb);
            }
        });
    },
    trackDownloadURL : trackDownloadURL,
    trackStreamURL : trackDownloadURL,
    // TODO use the code below, when trackDownloadURL does no longer fall back to stream url
    /*
    trackStreamURL : function(trackId, clientId, cb) {
        get('https://api.sndcdn.com/i1/tracks/' + trackId + '/streams?client_id=' + clientId, makeHeaders('https://soundcloud.com/'), function(err, resp) {
            if(err) {
                cb(err);
            } else {
                resp = JSON.parse(resp.body);
                var qualities = Object.keys(resp);
                if(qualities.length > 1) {
                    util.puts('WARNING: available more qualities, but using just the first one of: ' + qualities);
                }
                cb(null, resp[qualities[0]]);
            }
        });
    },
    */
    clientId : function(cb) {
        cb(null, "b45b1aa10f1ac2941910a7f0d10f8e28");
        // TODO hack this, when the hardcoded id no longer works
        //  curl https://a2.sndcdn.com/assets/sc-431833df.js|grep '^define("config"'
        //  or
        // require(['config'], function(config){console.log(config, config._store.client_id)}), 'go'
        /*
        get('https://soundcloud.com', makeHeaders(null), function(err, resp) {
            if(err) {
                cb(err);
            } else {
                clientIdFromHTML(resp.body, cb);
            }
        });
        */
    }
};
