var util = require('util');
var loadDashboard = function(window, url, callback) {
    var $ = window.$;
    util.puts('loading ' + url);
    $.scAjax({
        url: url,
        accept: 'text/html+partial',
        callback: function(loaded) {
            var $partial = $(loaded);
            $partial.filter('li.story').find('div.dashboard-item:last').addClass('last');
            $('#overview-list').throb(false).append($partial);
            $(window.document).trigger('onContentLoaded');
            callback();
        }
    });
};

module.exports = function(browser, cb) {
    var window = browser.window;
    var onload = function() {
        var nextURL;

        nextURL = $('a.show-more').last().attr('href');
        if(typeof nextURL !== 'undefined') {
            cb(function() {
                loadDashboard(window, nextURL, onload);
            });
            return;
        }

        nextURL = $('a.next_page').last().attr('href');
        if(typeof nextURL !== 'undefined') {
            cb(function() {
                util.puts('visit page: ' + nextURL);
                browser.visit(nextURL, function() {
                    util.puts('wait for dom events');
                    browser.wait(onload);
                });
            });
            return;
        }

        cb(null);
    };
    var $ = window.$;
    // if this dashboard url does not exist, then there are some dom elements of tracks, no need to load
    var dashboardURL = $('#overview-list').attr('data-sc-dashboard-path');
    if(dashboardURL) {
        loadDashboard(window, dashboardURL, onload);
    } else {
        onload();
    }
};
