var util = require('util');
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

module.exports = function(credentials, page, scrape) {
    var scrapePageTracks = function(page) {
        util.puts('visit page: ' + page);
        browser.visit('http://soundcloud.com' + page, function() {
            util.puts('wait for dom events');
            browser.wait(function() {
                scrape(browser.window);
            });
        });
    };

    if(credentials === null) {
        scrapePageTracks(page);
    } else {
        util.puts('visit page: /login');
        browser.visit("https://soundcloud.com/login", function () {
            browser.fill('username', credentials.username);
            browser.fill('password', credentials.password);
            util.puts('fill out the form and press login button');
            browser.pressButton('Log in', function() {
                scrapePageTracks(page);
            });
        });
    }
};
