var opt = require('optimist')
    .usage('Usage: $0 [options]')
    ['default']('page', '/dashboard/incoming')
    .string('page')
    .alias('page', 'a')
    .describe('page', 'Page with a list of tracks to download')
    ['default']('gap', 1000 * 60 * 60 * 24 * 7)
    .string('gap')
    .alias('gap', 'g')
    .describe('gap', 'Maximum gap between now and the last track to download, in milliseconds')
    ['default']('maxTracks', 10)
    .string('maxTracks')
    .alias('maxTracks', 'm')
    .describe('maxTracks', 'Maximum tracks to download')
    .demand('directory')
    .string('directory')
    .alias('directory', 'd')
    .describe('directory', 'Target directory for downloaded files')
    .string('password')
    .alias('password', 'p')
    .describe('password', 'SoundCloud user password')
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
var v = require('valentine');
var vt = require('vague-time');
var a = require('async');
var fs = require('fs');
var http = require('http');
var parseURL = require('url').parse;
var Browser = require('zombie');
var util = require('util');

argv.maxTracks = Number(argv.maxTracks);
argv.gap = Number(argv.gap);
util.puts('maxTracks: ' + argv.maxTracks);
var now = new Date().getTime();
util.puts('gap: ' + vt.get({ from : Math.floor((now - argv.gap) / 1000), to : Math.floor(now / 1000)}) + ' (' + argv.gap + ' milliseconds)');

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
    var cb = function(err, resolvedFile) {
        if(argv.debug) {
            if(err) {
                util.puts('resolveStream fail: ' + id + ' ' + file.filename);
            } else {
                util.puts('resolveStream finish: ' + id + ' ' + resolvedFile.filename);
            }
        }
        cb1(err, resolvedFile);
    };
    try {
        http.get(file.url, function(res) {
            if(argv.debug) {
                util.puts('resolveStream progress: ' + id + ' ' + res.headers.location);
            }
            try {
                http.get(res.headers.location, function(res) {
                    try {
                        res.destroy();
                        cb(null, {
                            date : file.date,
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
            } catch(err) {
                cb(err, null);
            }
        }).on('error', function(err) {
            cb(err, null);
        });
    } catch(err) {
        cb(err, null);
    }
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
                    var time = Math.floor(file.date.getTime() / 1000);
                    fs.utimes(file.filename, time, time, function() {
                        cb(null);
                    });
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
        var allAreOverGap = true;
        for(var i = 0; i < $players.length; i += 1) {
            var $a = $('.info-header h3 a', $players[i]);
            if($a.length === 0) {
                continue;
            }
            var date = new Date($('.pretty-date', $a.parent().parent()).attr('title'));
            var uri = $a.attr('href');
            var filename = argv.directory + '/' + uri.substr(1).replace(/\//g, '-');
            if(typeof foundFilenames[filename] === 'undefined') {
                foundFilenames[filename] = true;
            } else {
                continue;
            }
            if(argv.debug) {
                util.puts(date + ' ' + uri);
            }
            if((now - date.getTime()) <= argv.gap) {
                allAreOverGap = false;
            }
            var $download = $('.actions .download', $players[i]);
            if(!argv.streamed && $download.length > 0 && !$download.hasClass('disabled')) {
                files.push({
                    date : date,
                    filename : filename,
                    url : 'http://soundcloud.com' + uri + '/download'
                });
            } else {
                var dbTracks = w.SC.clientDB.getTracks();
                for(var j in dbTracks) {
                    if(dbTracks[j].uri === uri) {
                        files.push({
                            date : date,
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
        a.mapSeries(files, function(file, cb) {
            resolveStream(file, function(err, file) {
                if(err) {
                    util.puts(err.stack);
                    cb(null, null);
                } else {
                    cb(null, file);
                }
            });
        }, function(err, files) {
            if(argv.debug) {
                util.puts('Resolved them.');
            }
            if(err) {
                cb(err, null);
                return;
            }
            a.reject(files, function(file, cb) {
                if(file === null) {
                    cb(true);
                } else {
                    fs.exists(file.filename, cb);
                }
            }, function(files) {
                if(argv.debug) {
                    util.puts('Found not downloaded tracks in page: ' + files.length);
                }
                cb(null, {
                    allAreOverGap : allAreOverGap,
                    files : files
                });
            });
        });
    };
    var compareFilesDate = function(a, b) {
        return b.date.getTime() - a.date.getTime();
    };
    var syncDashboardRound = function() {
        extractCurrentFiles(function(err, currentFiles) {
            if(err) {
                throw err;
            }
            var nextURL = $('a.show-more').last().attr('href');
            files.push.apply(files, currentFiles.files);
            files.sort(compareFilesDate);
            if(!nextURL || files.length >= argv.maxTracks || currentFiles.allAreOverGap) {
                if(files.length === 0) {
                    util.puts('Nothing new to download.');
                    return;
                }
                if(files.length > argv.maxTracks) {
                    files = files.slice(0, argv.maxTracks);
                }
                if((now - files[files.length - 1].date.getTime()) > argv.gap) {
                    if(argv.debug) {
                        util.puts('Okey, trimming by gap');
                    }
                    var first = -1;
                    v.some(files, function(file, i) {
                        if((now - file.date.getTime()) > argv.gap) {
                            first = i;
                            return true;
                        }
                    });
                    if(argv.debug) {
                        util.puts('the first track to reject is ' + JSON.stringify(files[first]));
                    }
                    if(first >= 0) {
                        files = files.slice(0, first);
                    }
                }
                util.puts('Downloading ' + files.length + ' tracks.');
                util.puts('The first was uploaded at ' + files[0].date);
                util.puts('The last was uploaded at ' + files[files.length - 1].date);
                a.forEach(files, tryDownload, function(err) {
                    if(err) {
                        throw err;
                    }
                    util.puts('Done.');
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

var scrapePageTracks = function(page) {
    util.puts('visit page: ' + page);
    browser.visit('http://soundcloud.com' + page, function() {
        browser.window.jQuery(scrape);
    });
};

if(typeof argv.username === 'undefined') {
    scrapePageTracks(argv.page);
} else {
    util.puts('visit page: /login');
    browser.visit("https://soundcloud.com/login", function () {
        browser.fill('username', argv.username);
        browser.fill('password', argv.password);
        util.puts('fill out the form and press login button');
        browser.pressButton('Log in', function() {
            scrapePageTracks(argv.page);
        });
    });
}
