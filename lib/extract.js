module.exports = function(streamed, window, makeName) {
    var $ = window.$;
    var $players = $('div.player');
    var files = [];
    for(var i = 0; i < $players.length; i += 1) {
        var $a = $('.info-header h3 a', $players[i]);
        if($a.length === 0) {
            continue;
        }
        var date = new Date($('.pretty-date', $a.parent().parent()).attr('title'));
        var uri = $a.attr('href');
        var vars = uri.substr(1).split('/');
        var $download = $('.actions .download', $players[i]);
        if(!streamed && $download.length > 0 && !$download.hasClass('disabled')) {
            files.push({
                artist : vars[0],
                title : vars[1],
                date : date,
                url : 'http://soundcloud.com' + uri + '/download'
            });
        } else {
            var dbTracks = window.SC.clientDB.getTracks();
            for(var j in dbTracks) {
                if(dbTracks[j].uri === uri) {
                    files.push({
                        artist : vars[0],
                        title : vars[1],
                        date : date,
                        url : dbTracks[j].streamUrl
                    });
                    break;
                }
            }
        }
    }
    return files;
};
