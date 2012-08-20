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
var a = require('async');
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
    return suffix;
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
    var tryDownload = function(file, cb) {
        getStreamInfo(file.url, function(err, info) {
            var filename = file.filename + info.suffix;
            util.puts('begin ' + file.url + ' -> ' + filename);
            info.response.pipe(fs.createWriteStream(filename));
            todownload += 1;
            info.response.on('end', function() {
                downloaded += 1;
                util.puts('end ' + file.url + ' -> ' + filename + ' (' + downloaded + ' of ' + todownload + ')');
                cb(null);
            });
        });
    };
    var files = [];
    var extractCurrentFiles = function(cb) {
        var $players = $('.player');
        var files = [];
        for(var i = 0; i < $players.length; i += 1) {
            var uri = $('.info-header h3 a', $players[i]).attr('href');
            var filename = argv.directory + '/' + uri.substr(1).replace(/\//g, '-');
            if(!argv.streamed && $('.actions .download', $players[i]).length > 0) {
                files.push({
                    filename : filename,
                    url : 'http://soundcloud.com' + uri + '/download'
                });
            } else {
                var dbTracks = w.SC.clientDB.getTracks();
                for(var j in dbTracks) {
                    if(dbTracks[j].uri === uri) {
                        files.push({
                            filename : filename,
                            url : dbTracks[j].streamUrl
                        });
                    }
                }
            }
        }
        a.reject(files, function(file, cb) {
            fs.exists(file.filename, cb);
        }, cb);
    };
    var syncDashboardRound = function(url) {
        util.puts('MOAR ' + url);
        extractCurrentFiles(function(currentFiles) {
            files.push.apply(files, currentFiles);
            if(files.length > argv.maxTracks) {
                // TODO curb files to maxTracks
                a.forEach(files, tryDownload, function(err) {
                    if(err) {
                        throw err;
                    }
                    util.puts('That\'s it, downloaded ' + files.length + ' tracks');
                });
            } else {
                loadDashboard(url, function() {
                    syncDashboardRound($('a.show-more').last().attr('href'));
                });
            }
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
        util.puts('open page: ' + argv.page);
        browser.visit('http://soundcloud.com' + argv.page, function() {
            browser.window.jQuery(scrape);
        });
    });
});
