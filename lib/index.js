var opt = require('optimist')
    .usage('Usage: $0 [options]')
    ['default']('page', '/dashboard/incoming')
    .string('page')
    .alias('page', 'a')
    .describe('page', 'Page with a list of tracks to download')
    ['default']('maxTracks', 10)
    .string('maxTracks')
    .alias('maxTracks', 'm')
    .describe('maxTracks', 'Maximum tracks to download')
    .demand('directory')
    .string('directory')
    .alias('directory', 'd')
    .describe('directory', 'Target directory for downloaded files')
    .demand('password')
    .string('password')
    .alias('password', 'p')
    .describe('password', 'SoundCloud user password')
    .demand('username')
    .string('username')
    .alias('username', 'u')
    .describe('username', 'SoundCloud user email')
    .boolean('streamed')
    .alias('streamed', 's')
    .describe('streamed', 'Always download the streaming version - ignore original high quality download')
    .boolean('debug')
    .alias('debug', 'd')
    .describe('debug', 'Output uncaught JavaScript exceptions')
    .boolean('help')
    .alias('help', 'h')
    .describe('help', 'Show this message');
var argv = opt.argv;
if(argv.help) {
    opt.showHelp();
    process.exit(1);
}
argv.maxTracks = Number(argv.maxTracks);
var step = require('step');
var fs = require('fs');
var http = require('http');
var parseURL = require('url').parse;
var Browser = require('zombie');
var util = require('util');

process.on('uncaughtException', function(err) {
    if(argv.debug) {
        util.puts('Uncaught Exception: ' + err.message + '\n' + err.stack);
    }
});

var mimeTypeToSuffix = {
    'audio/x-wav' : 'wav',
    'audio/mp4' : 'mp4',
    'audio/mpeg' : 'mp3'
};
var getSuffix = function(headers) {
    var suffix;
    if(headers['content-disposition']) {
        suffix = headers['content-disposition'];
        suffix = suffix.substr(suffix.lastIndexOf('.'));
        var last = suffix.charAt(suffix.length - 1);
        if(last === '\'' || last === '"') {
            suffix = suffix.substr(0, suffix.length - 1);
        }
    } else {
        var mimeType = headers['content-type'];
        if(mimeTypeToSuffix[mimeType]) {
            suffix = '.' + mimeTypeToSuffix[mimeType];
        } else {
            util.puts('warning: unknown mime type ' + mimeType);
            suffix = '';
        }
    }
};

var getStreamInfo = function(url, cb) {
    http.get(url, function(res) {
        url = res.headers.location;
        http.get(url, function(res) {
            cb(null, {
                suffix : getSuffix(res.headers),
                response : res
            });
        });
    });
};
var download = function(res, filename, cb) {
    fs.open(filename, 'w', function(err, fd) {
        if(err) {
            throw err;
        }
        res.on('data', function(buf) {
            fs.write(fd, buf, 0, buf.length, null);
        });
        res.on('end', function() {
            fs.close(fd);
            cb(null);
        });
    });
};

var browser = new Browser({
    debug : false,
    silent : true
});

console.log = function() {
    return arguments;
};

var scrape = function() {
    var w = browser.window;
    var $ = w.jQuery;
    // begin soundcloud.com -------------------------------------
    var $overviewlist = $('#overview-list'), dashboardUrl = $overviewlist.attr('data-sc-dashboard-path'), dashboardXhr, loadDashboard = function(url, callback, reset) {
        if (dashboardXhr && $.isFunction(dashboardXhr.abort)) {
            dashboardXhr.abort();
        }
        dashboardXhr = $.scAjax({url: url,accept: 'text/html+partial',callback: function(loaded) {
                var $partial = $(loaded);
                $partial.filter('li.story').find('div.dashboard-item:last').addClass('last');
                $overviewlist.throb(false).append($partial);
                if (callback) {
                    callback($partial);
                }
                $(w.document).trigger('onContentLoaded');
            }});
    };
    // end soundcloud.com -------------------------------------
    var todownload = 0;
    var downloaded = 0;
    var tryDownload = function(url, filename, cb) {
        getStreamInfo(url, function(err, info) {
            filename += info.suffix;
            fs.exists(filename, function(exists) {
                if(exists) {
                    info.response.destroy();
                    cb(null, false);
                } else if(todownload === argv.maxTracks) {
                    info.response.destroy();
                    cb(null, true);
                } else {
                    todownload += 1;
                    util.puts('begin ' + url + ' -> ' + filename);
                    download(info.response, filename, function(exists) {
                        downloaded += 1;
                        util.puts('end ' + url + ' -> ' + filename + ' (' + downloaded + ' of ' + todownload + ')');
                        cb(null, false);
                    });
                }
            });
        });
    };
    var syncDashboard = function(cb) {
        var $players = $('.player');
        step(function() {
            var group = this.group();
            for(var i = 0; i < $players.length; i += 1) {
                var uri = $('.info-header h3 a', $players[i]).attr('href');
                if(!argv.streamed && $('.actions .download', $players[i]).length > 0) {
                    tryDownload('http://soundcloud.com' + uri + '/download', argv.directory + '/' + uri.substr(1).replace(/\//g, '-'), group());
                } else {
                    var dbTracks = w.SC.clientDB.getTracks();
                    for(var j in dbTracks) {
                        if(dbTracks[j].uri === uri) {
                            tryDownload(dbTracks[j].streamUrl, argv.directory + '/' + uri.substr(1).replace(/\//g, '-'), group());
                        }
                    }
                }
            }
        }, cb);
    };
    var syncDashboardRound = function(url) {
        util.puts('syncDashboardRound: ' + url);
        syncDashboard(function(err, stop) {
            for(var i = 0; i < stop.length; i += 1) {
                if(stop[i]) {
                    return;
                }
            }
            loadDashboard(url, function() {
                syncDashboardRound($('a.show-more').last().attr('href'));
            });
        });
    };
    syncDashboardRound(dashboardUrl);
};

util.puts('visit login form');
browser.visit("https://soundcloud.com/login", function () {
    browser.fill('username', argv.username);
    browser.fill('password', argv.password);
    util.puts('press login button');
    browser.pressButton('Log in', function() {
        util.puts('open incoming tracks page');
        browser.visit('http://soundcloud.com' + argv.page, function() {
            browser.window.jQuery(scrape);
        });
    });
});
