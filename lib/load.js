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

module.exports = function(window, cb) {
    var onload = function() {
        var nextURL = $('a.show-more').last().attr('href');
        cb(nextURL ? function() {
            loadDashboard(window, nextURL, onload);
        } : null);
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
