var log4js = require('log4js');
var logger = log4js.getLogger();
logger.setLevel('DEBUG');
logger.info('START');

var api = require('./api');
api.clientId(function(err, id) {
    logger.info(err, id);
    api.artistId('barbnerdy', id, function(err, artistId) {
        logger.info(err, artistId);
    });
});
