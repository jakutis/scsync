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
    .alias('debug', 'b')
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
var v = require('valentine');
var a = require('async');
var fs = require('fs');
var http = require('http');
var parseURL = require('url').parse;
var Browser = require('zombie');
var util = require('util');

process.on('uncaughtException', function(err) {
    if(argv.debug) {
        util.puts(err.stack);
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
            throw new Error('mime type ' + mimeType);
        }
    }
    return suffix;
};

var gid = 0;
var resolveStream = function(file, cb1) {
    var id = gid;
    gid += 1;
    if(argv.debug) {
        util.puts('resolveStream start: ' + id + ' ' + file.filename);
    }
    var cb = function(err, file) {
        if(argv.debug) {
            util.puts('resolveStream finish: ' + id + ' ' + file.filename);
        }
        cb1(err, file);
    };
    http.get(file.url, function(res) {
        if(argv.debug) {
            util.puts('resolveStream progress: ' + id + ' ' + res.headers.location);
        }
        http.get(res.headers.location, function(res) {
            try {
                res.destroy();
                cb(null, {
                    url : file.url,
                    filename : file.filename + getSuffix(res.headers)
                });
            } catch(err) {
                cb(err, null);
            }
        }).on('close', function() {
            if(argv.debug) {
                util.puts('resolveStream close: ' + id + ' ' + JSON.stringify(arguments));
            }
        }).on('end', function() {
            if(argv.debug) {
                util.puts('resolveStream end: ' + id + ' ' + JSON.stringify(arguments));
            }
        }).on('error', function(err) {
            cb(err, null);
        });
    }).on('error', function(err) {
        cb(err, null);
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
        util.puts('load more ' + url);
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
        util.puts('begin ' + file.filename);
        todownload += 1;
        http.get(file.url, function(res) {
            http.get(res.headers.location, function(res) {
                res.on('error', cb);
                res.on('end', function() {
                    downloaded += 1;
                    util.puts('end ' + file.filename + ' (' + downloaded + ' of ' + todownload + ')');
                    cb(null);
                });
                res.pipe(fs.createWriteStream(file.filename));
            });
        });
    };
    var files = [];
    var foundFilenames = {};
    var extractCurrentFiles = function(cb) {
        var $players = $('div.player');
        var files = [];
        for(var i = 0; i < $players.length; i += 1) {
            var $a = $('.info-header h3 a', $players[i]);
            if($a.length === 0) {
                continue;
            }
            var uri = $a.attr('href');
            var filename = argv.directory + '/' + uri.substr(1).replace(/\//g, '-');
            if(typeof foundFilenames[filename] === 'undefined') {
                foundFilenames[filename] = true;
            } else {
                continue;
            }
            var $download = $('.actions .download', $players[i]);
            if(!argv.streamed && $download.length > 0 && !$download.hasClass('disabled')) {
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
                        break;
                    }
                }
            }
        }
        if(argv.debug) {
            util.puts('Found new tracks in page: ' + files.length);
        }
        a.mapSeries(files, resolveStream, function(err, files) {
            if(argv.debug) {
                util.puts('Resolved them.');
            }
            if(err) {
                cb(err, null);
                return;
            }
            a.reject(files, function(file, cb) {
                fs.exists(file.filename, cb);
            }, function(files) {
                if(argv.debug) {
                    util.puts('Found not downloaded tracks in page: ' + files.length);
                }
                cb(null, files);
            });
        });
    };
    var syncDashboardRound = function() {
        extractCurrentFiles(function(err, currentFiles) {
            if(err) {
                throw err;
            }
            var nextURL = $('a.show-more').last().attr('href');
            files.push.apply(files, currentFiles);
            if(!nextURL || files.length >= argv.maxTracks) {
                if(files.length > argv.maxTracks) {
                    files = files.slice(0, argv.maxTracks);
                }
                a.forEach(files, tryDownload, function(err) {
                    if(err) {
                        throw err;
                    }
                    util.puts('That\'s it, downloaded ' + files.length + ' tracks');
                });
            } else {
                loadDashboard(nextURL, syncDashboardRound);
            }
        });
    };
    if(dashboardUrl) {
        loadDashboard(dashboardUrl, syncDashboardRound);
    } else {
        syncDashboardRound();
    }
};

util.puts('visit page: /login');
browser.visit("https://soundcloud.com/login", function () {
    browser.fill('username', argv.username);
    browser.fill('password', argv.password);
    util.puts('fill out the form and press login button');
    browser.pressButton('Log in', function() {
        util.puts('visit page: ' + argv.page);
        browser.visit('http://soundcloud.com' + argv.page, function() {
            browser.window.jQuery(scrape);
        });
    });
});
