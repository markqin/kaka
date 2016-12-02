'use strict';

// var LOG = ['log', 'error', 'warning', 'info', 'ok'];

// define Log class
class Log{
  // get vars by Log.xxx
  constructor(msg, lType){
    // if Log obj is used as fake-console, msg is a string, lType can be divided into 4 types
    // else msg is fileFtpPaths, lType is current ftp bill address and demo address
    this.msg = msg;
    this.lType = lType;
  }

  scrollBottom() {
    let $showBox = document.getElementById('js_showLogArea');
    $showBox.scrollTop($showBox.scrollHeight);
  }

  // generate structure and insert into exsiting DOM
  generateLog(){
    let $LogWrapper = document.getElementById('js_logBox');
    let logHtml = '<p class="txt '+ this.lType.toLowerCase() +'">'+ this.msg +'</p>';
    // Log area wrapper
    let logEle = document.createElement('p');
    logEle.className = 'txt'+ this.lType.toLowerCase() ;
    logEle.innerHTML = this.msg;
    $LogWrapper.innerHTML+=logHtml;
    this.scrollBottom();
  }
}


// API

/* ***
 * @object: log [直接引用 log 对象]
 * @param: msg, the content you want to show in log [想要打印出来的信息]
 * @param: lType, 4 types: log, error, warning, info [4种类型：log、error、warning、info]
 *         if lType is an Object, then the log should be Bill path [如果 lType 是 Object 类型，那么要当做提单路径来处理]
 */
module.exports = function(msg, lType){
  try{
    var _log = new Log(msg, lType);
    if(typeof lType === 'string' ){
      // generate normal log DOM
      _log.generateLog();
    } else{
      // generate bill addr and demo addr DOM
      _log.generateBill();
    }
  }catch(e){
    // using in cmd
    console.log(msg);
  }
};