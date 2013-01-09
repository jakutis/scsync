var opt = require('optimist')
    .usage('Usage: $0 [options]')
    .demand('artist')
    .string('artist')
    .alias('artist', 'a')
    .describe('artist', 'Artist permalink/username')
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
    .boolean('streamed')
    .alias('streamed', 's')
    ['default']('streamed', false)
    .describe('streamed', 'Always download the streaming version - ignore original high quality download')
    .boolean('debug')
    .alias('debug', 'b')
    ['default']('debug', false)
    .describe('debug', 'Output uncaught JavaScript exceptions')
    .boolean('help')
    .alias('help', 'h')
    ['default']('help', false)
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

scrape({
    artist : argv.artist,
    maxTracks : Number(argv.maxTracks),
    gap : Number(argv.gap),
    directory : argv.directory,
    format : argv.format,
    debug : argv.debug,
    streamed : argv.streamed
});
