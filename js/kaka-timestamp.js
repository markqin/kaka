'use strict';

var os = require('os');


/**
 * 获得时间戳
 *
 * @param  {Object} opts
 * @return {String}
 */
function getTimestamp(opts) {
	var timestamp = '';

	if(opts) {
		// 用户标识
		var userTag;
		try {
			userTag = opts.userName.match(/\w+/)[0];
			userTag = userTag.slice(0,2).toLowerCase()+userTag.slice(-1).toLowerCase();
		} catch (err) {
			userTag = '';
		}
		if(opts.timestampAddUserTag) {
			timestamp = userTag + getNow();
		} else {
			timestamp = getNow();
		}
	    
	} else {
		timestamp = getNow();
	}
    

    return timestamp;
}


/**
 * 得到当前时间
 *
 * @return {String}
 */

function getNow() {
    var date = new Date();
    var y = date.getFullYear().toString().slice(2),
        mon = date.getMonth()+1,
        d = date.getDate(),
        h = date.getHours(),
        m = date.getMinutes(),
        s = date.getSeconds();

    mon = mon<10 ? '0'+mon.toString() : mon.toString();
    d = d<10 ? '0'+d.toString() : d.toString();
    h = h<10 ? '0'+h.toString() : h.toString();
    m = m<10 ? '0'+m.toString() : m.toString();
    s = s<10 ? '0'+s.toString() : s.toString();

    return y+mon+d+h+m+s;
}


module.exports = getTimestamp;
