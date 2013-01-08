module.exports = function(streamed, window, makeName) {
    var util = require('util');
    util.puts('WILL DO');
    var j =0;
    var h = function(){
        j+=1;
        console.log(new Date());
        window.require(['config'], function(cfg){util.puts('CLIENT ID: ' + cfg._store.client_id);});
        if(j < 10) {
            setTimeout(h, 1000);
        } else {
            util.puts('DONE');
            process.exit();
        }
    };
    h();
    return;
    var $ = window.$;
    var $players = $('.sound');
    var files = [];
    for(var i = 0; i < $players.length; i += 1) {
        var date = new Date($('time', $players[i]).attr('datetime'));
        var uri = $('.soundTitle__title', $players[i]).attr('href');
        var vars = uri.substr(1).split('/');
        var $download = $('.actions .download', $players[i]);//TODO
        // client id
        //  curl https://a2.sndcdn.com/assets/sc-431833df.js|grep '^define("config"'
        //  or
        // require(['config'], function(config){console.log(config, config._store.client_id)}), 'go'

        // artist id
        // https://api.sndcdn.com/resolve?url=https%3A//soundcloud.com/durbanpoison&_status_code_map%5B302%5D=200&_status_format=json&client_id=b45b1aa10f1ac2941910a7f0d10f8e28
        //               "name": "Location",
        //                             "value": "https://api.sndcdn.com/users/1767080?client_id=b45b1aa10f1ac2941910a7f0d10f8e28"
        //                                         },

        // track id
        //           "url": "https://api.sndcdn.com/resolve?url=https%3A//soundcloud.com/durbanpoison/mindgames&_status_code_map%5B302%5D=200&_status_format=json&client_id=b45b1aa10f1ac2941910a7f0d10f8e28",
        //                        {
        //                                      "name": "Location",
        //                                                    "value": "https://api.sndcdn.com/tracks/49665886?client_id=b45b1aa10f1ac2941910a7f0d10f8e28"
        //                                                                },

        // track download url
        // https://api.soundcloud.com/tracks/70587582/download?client_id=b45b1aa10f1ac2941910a7f0d10f8e28

        // track stream url
        // https://api.sndcdn.com/i1/tracks/49665886/streams?client_id=b45b1aa10f1ac2941910a7f0d10f8e28
        // {"http_mp3_128_url":"http://ec-media.soundcloud.com/zGavWFWwrgIy.128.mp3?ff61182e3c2ecefa438cd02102d0e385713f0c1faf3b0339595666ff0706e31c14c882872840afd0527a624afd0c7735f14587a7ca961ece2bd7e52d06ba48caf1bf5c532c\u0026AWSAccessKeyId=AKIAJ4IAZE5EOI7PA7VQ\u0026Expires=1355838826\u0026Signature=X9OKC39DnrqbPLsGsTzpk6EN9No%3D"}
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
