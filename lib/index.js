var opt = require('optimist')
    .usage('Usage: $0 [options]')
    ['default']('m', '10')
    .string('m')
    .alias('m', 'maxTracks')
    .describe('m', 'Maximum tracks to download')
    .demand('d')
    .string('d')
    .alias('d', 'directory')
    .describe('d', 'Target directory for downloads')
    .demand('p')
    .string('p')
    .alias('p', 'password')
    .describe('p', 'SoundCloud password')
    .demand('u')
    .string('u')
    .alias('u', 'username')
    .describe('u', 'SoundCloud username or email')
    .boolean('h')
    .alias('h', 'help')
    .describe('h', 'Show this message');
var argv = opt.argv;
if(argv.help) {
    opt.showHelp();
} else {
    argv.maxTracks = Number(argv.maxTracks);
var step = require('step');
var fs = require('fs');
var http = require('http');
var parseURL = require('url').parse;
var Browser = require('zombie');
var util = require('util');

process.on('uncaughtException', function(err) {
});

var download = function(url, filename, cb) {
    http.get(url, function(res) {
        http.get(res.headers.location, function(res) {
            fs.open(filename, 'w', function(err, fd) {
                if(err) throw err;
                res.on('data', function(buf) {
                    fs.write(fd, buf, 0, buf.length, null);
                });
                res.on('end', function() {
                    fs.close(fd);
                    cb();
                })
            });
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

util.puts('visit login form');
browser.visit("https://soundcloud.com/login", function () {
    browser.fill('username', argv.username);
    browser.fill('password', argv.password);
    util.puts('press login button');
    browser.pressButton('Log in', function() {
        util.puts('open incoming tracks page');
        browser.visit('http://soundcloud.com/dashboard/incoming', function() {
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
                        $(document).trigger('onContentLoaded');
                    }});
            };
            // end soundcloud.com -------------------------------------
            if($overviewlist.length === 0) {
                util.puts('#overview-list was not found');
                process.exit(1);
                return;
            }
            var todownload = 0;
            var downloaded = 0;
            var syncDashboard = function(cb) {
                var $tracks = $('li.track');
                if($tracks.length > 0) {
                    var $info = $('li.track .info-header h3 a');
                    step(function() {
                        var group = this.group();
                        for(var i = 0; i < $info.length; i += 1) {
                            var uri = $($info[i]).attr('href');
                            var dbTracks = w.SC.clientDB.getTracks();
                            for(var j in dbTracks) {
                                if(dbTracks[j].uri === uri) {
                                    (function(cb, streamURL, filename) {
                                        fs.exists(filename, function(exists) {
                                            if(exists) {
                                                cb(null, false);
                                            } else if(todownload === argv.maxTracks) {
                                                cb(null, true);
                                            } else {
                                                todownload += 1;
                                                util.puts('begin ' + streamURL + ' -> ' + filename);
                                                download(streamURL, filename, function() {
                                                    downloaded += 1;
                                                    util.puts('end ' + streamURL + ' -> ' + filename + ' (' + downloaded + ' of ' + todownload + ')');
                                                    cb(null, false)
                                                });
                                            }
                                        });
                                    })(group(), dbTracks[j].streamUrl, argv.directory + '/' + uri.substr(1).replace(/\//g, '-') + '.mp3')
                                }
                            }
                        }
                    }, cb);
                } else {
                    cb(null, []);
                }
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
        });
    })
});
}
