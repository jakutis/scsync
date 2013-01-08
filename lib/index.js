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
    .string('format')
    .alias('format', 'f')
    ['default']('format', 'y-m-d a - t')
    .describe('format', 'Downloaded filename format, for format details, supply "?" here')
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
var http = require('http');
var parseURL = require('url').parse;
var util = require('util');
var scrape = require('./scrape');

if(argv.format === '?') {
    util.puts('y - year, e.g. 2012');
    util.puts('m - month, e.g. 08');
    util.puts('d - day, e.g. 16');
    util.puts('a - artist username, e.g. barbnerdy');
    util.puts('t - track name, e.g. dubstep-mix-with-a-funny-ending');
    util.puts('to escape these characters, use a \\');
    process.exit(1);
}

process.on('uncaughtException', function(err) {
    if(argv.debug) {
        util.puts(err.stack);
    }
});

/*
console.log = function() {
    return arguments;
};
*/

var Browser = require('zombie');

var browser = new Browser({
    debug : false,
    silent : true,
    loadCSS : true,
    maxWait : 5000,
    runScripts : true,
    userAgent : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.64 Safari/537.11',
    waitFor : 5000,
    windowName : ''
});

var begin = function() {
    util.puts('visit: ' + argv.page);
    browser.visit('http://soundcloud.com' + argv.page, function() {
        util.puts('wait for dom events');
        browser.wait(function() {
            util.puts('scrape');
            scrape({
                browser : browser,
                maxTracks : Number(argv.maxTracks),
                gap : Number(argv.gap),
                directory : argv.directory,
                format : argv.format,
                debug : argv.debug,
                streamed : argv.streamed
            });
        });
    });
};

if(typeof argv.username === 'undefined') {
    begin();
} else {
    util.puts('visit page: /login');
    browser.visit("https://soundcloud.com/login", function () {
        browser.fill('username', argv.username);
        browser.fill('password', argv.password);
        util.puts('fill out the form and press login button');
        browser.pressButton('Log in', begin);
    });
}
