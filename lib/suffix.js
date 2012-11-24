var mimeTypeToSuffix = {
    'audio/x-wav' : 'wav',
    'audio/mp4' : 'mp4',
    'audio/mpeg' : 'mp3'
};

module.exports = function(headers) {
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
