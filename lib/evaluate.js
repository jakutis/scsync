module.exports = function(vars, format) {
    var i = 0;
    var str = '';
    var l = 0;
    while(i < format.length) {
        var c = format.charAt(i);
        if(c === '\\') {
            i += 2;
            continue;
        }
        if(typeof vars[c] === 'string') {
            str += format.substring(l, i);
            str += vars[c];
            l = i + 1;
        }
        i += 1;
    }
    str += format.substr(l);
    return str;
};
