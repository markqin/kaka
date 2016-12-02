'use strict';

var path = require('path');
var async = require('async');
var lodash = require('lodash');
var log = require('./log.js');


module.exports = function(cb) {

  var $dropZoneWrap = document.getElementById('js_dropZone'),
      dropZone = document.getElementById('js_showLogArea');
  dropZone.addEventListener("dragstart", function(e){
    e.preventDefault();
  }, false);

  dropZone.addEventListener("drag", function(e){
    e.preventDefault();
  }, false);

  dropZone.addEventListener("dragenter", function(e){
    e.preventDefault();
  }, false);

  dropZone.addEventListener("dragend", function(e){
    e.preventDefault();
  }, false);

  dropZone.addEventListener("dragover", function(e){
    e.preventDefault();
    addClass($dropZoneWrap,'drop-hover');
    removeClass($dropZoneWrap,'drop-end');
  }, false);

  dropZone.addEventListener("dragleave", function(e){
    e.preventDefault();
    removeClass($dropZoneWrap,'drop-hover');
  }, false);

  dropZone.addEventListener("drop", function (e) {
    e.preventDefault();
    removeClass($dropZoneWrap,'drop-hover');
    addClass($dropZoneWrap,'drop-end');

    // 清除上次处理的log
    var $LogWrapper = document.getElementById('js_logBox');
    $LogWrapper.innerHTML ="";
    // 取出文件信息
    var items = e.dataTransfer.items || [], firstEntry;
    
    /*var dragFiles = e.dataTransfer.files;
    // console.log(dragFiles)

    var allFilesInfo = [];
    async.forEachOf(items, function (item, key, callback) {
      var entry = item.webkitGetAsEntry();
      if(entry.isDirectory) {
        walkFileSystem(entry, function(files) {
          allFilesInfo.unshift.apply(allFilesInfo, files);
          callback();
        });
      } else {
        callback();
      }
    }, function (err) {
      if(err) {
        log('遍历文件夹出错: '+ err.message, 'error');
        return;
      } else {
        // console.log(allFilesInfo)
        handleFiles(allFilesInfo, function (filesPath) {
          if(cb) {
            cb(filesPath)
          }
        })
      }
    })*/

    if (items[0] && items[0].webkitGetAsEntry && (firstEntry = items[0].webkitGetAsEntry())) {
      walkFileSystem(firstEntry.filesystem.root, function(files) {

        if(cb) {
          cb(files);
        }
        
        /*handleFiles(files, function (filesPath) {
          if(cb) {
            cb(filesPath)
          }
        })*/
      });
    }

  }, false);

}


/**
 * 遍历文件夹所有文件
 *
 * @param  {Object} directory
 * @param  {Function} callback
 * @param  {Function} error
 * @return {Array} callback
 */
function walkFileSystem(directory, callback, error) {
  if (!callback.pending) {
    callback.pending = 0;
  }
  if (!callback.files) {
    callback.files = []
  }
  
  callback.pending++;
  
  var reader = directory.createReader();
  reader.readEntries(function(entries) {
    callback.pending--;

    for(var i=0; i<entries.length; i++) {
      if (entries[i].isFile) {
        callback.pending++;
        entries[i].file(function(File) {
          callback.files.push(File);
          if (--callback.pending === 0) {
            callback(callback.files);
          }
        }, error);
      } else {
        walkFileSystem(entries[i], callback, error);
      }
    }
    
    if (callback.pending === 0) {
      callback(callback.files);
    }
  }, error);
}


/**
 * 处理文件信息
 *
 * @param  {Array} files
 * @param  {Function} cb
 * @return {Array} callback
 */
/*function handleFiles(files, cb) {
  var filesInfo = files;
  var $fileList = $('#js_fileList');
  // console.log(filesInfo)

  // 取出暂存数据
  var nowFilesData = $fileList.data('filesInfoData');
  if(nowFilesData) {
    filesInfo = filesInfo.concat(nowFilesData.filesInfo);
  }

  // 存入数据
  var filesInfoData = {
    filesInfo : filesInfo
  }
  $fileList.data('filesInfoData', filesInfoData);

  // 数据去重
  var flags = {};
  var filesInfoUniq = filesInfo.filter(function(item) {
      if (flags[item.path]) {
        return false;
      }
      flags[item.path] = true;
      return true;
  });

  // 取出文件信息
  var filesInfoHtml = '';
  var filesPath = [];
  filesInfoUniq.forEach(function (fileInfo) {
    var filePath = fileInfo.path.split(path.sep).join('/');
    filesPath.push(filePath);
    var fileInfoHtml =  filePath+' - (' + prettyBytes(fileInfo.size) + ')'
    filesInfoHtml += '<li class="item">'+fileInfoHtml+'</li>';
  })
  
  // 写入文件列表
  filesInfoHtml = '<h3>待处理文件：</h3><ul class="file-list">'+filesInfoHtml+'</ul>';
  $fileList.html(filesInfoHtml);
  $fileList.removeClass('none');
  $('#js_summaryBox').addClass('none');
  var $showBox = $('#js_showLogArea');
  $showBox.scrollTop($showBox[0].scrollHeight);

  // 返回文件路径
  if(cb) {
    cb(filesPath);
  }

}*/


/**
 * 数字转字节单位
 *
 * @param  {Number} num
 * @return {String}
 */
/*function prettyBytes(num) {
  if (typeof num !== 'number' || Number.isNaN(num)) {
    throw new TypeError('Input must be a number');
  }

  var exponent;
  var unit;
  var neg = num < 0;

  if (neg) {
    num = -num;
  }

  if (num === 0) {
    return '0 B';
  }

  exponent = Math.floor(Math.log(num) / Math.log(1000));
  num = (num / Math.pow(1000, exponent)).toFixed(2) * 1;
  unit = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'][exponent];

  return (neg ? '-' : '') + num + ' ' + unit;
};*/


function hasClass(obj, cls) {
  return obj.className.match(new RegExp('(\\s|^)' + cls + '(\\s|$)'));
}

function addClass(obj, cls) {
    if (!hasClass(obj, cls)) obj.className += " " + cls;
}

function removeClass(obj, cls) {
    if (hasClass(obj, cls)) {
        var reg = new RegExp('(\\s|^)' + cls + '(\\s|$)');
        obj.className = obj.className.replace(reg, ' ');
    }
}