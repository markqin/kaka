'use strict';

var time_load_start = +new Date();
// window.$ = window.jQuery = require("./js/vendor/jquery.min.js");

var shell = require('electron').shell;
var dialog = require('electron').remote.dialog; 

var fs = require('fs');
var path = require('path');
var lodash = require('lodash');
var async = require('async');
var postcss = require('postcss');
var spritesmith = require('spritesmith');
var imagemin = require('imagemin');
var gulp = require('gulp');
var cleanCss = require('clean-css');
var gulpRename = require('gulp-rename');
var imageSize = require('image-size');
var mkdirp = require('mkdirp');
var ftp = require('ftp');
var mime = require('mime');
var qrCode = require('qrcode-npm');

var kakaFiles = require('./js/kaka-handle-files');
var kakaRmdir = require('./js/kaka-rmdir');
var kakaTime = require('./js/kaka-timestamp');
var kakaSprite = require('./js/kaka-css-sprite');
var kakaFilePre = require('./js/kaka-files-preprocess');
var kakaCSS = require('./js/kaka-handle-css');
var kakaImgMin = require('./js/kaka-image-minify');

var kakaSet = require('./js/set.js');
var dragDrop = require('./js/drag-drop.js');
// var uploadFtp = require('./js/upload-ftp.js');
var kakaUpload = require('./js/kaka-upload.js');
var log = require('./js/log.js');

var Clipboard = require("./js/vendor/clipboard.min.js");

var LS = localStorage;

// 收集待处理文件路径
var readyFilesPath = [];
// 收集窗口打开文件信息
var readyWinFilesInfo = [];


$(document).ready(function () {

	var time_load_end = +new Date();

	$('#js_pageMask').hide();

	log('模块预加载成功!', 'ok')
	log('共耗时: '+ (time_load_end - time_load_start)/1000+'s', 'info');
	
	
	// 设置初始化
	kakaSet();

	// 版本检查
	$("#j_kaka_update").on("click",function(){
		//检查更新
		var cur = "0.2.2";
		if(kakaParams.version!=cur){
			alert("版本有更新，将退出程序并下载新版本！");
			if (process.platform != 'darwin') {//windows
				shell.openExternal(kakaParams.windowslink);
				window.close();
			}else{
				shell.openExternal(kakaParams.maclink);
				window.close();
			}
		}else{
			alert("当前已是最新版本");
		}
	});

	$('#j_kaka_info').on('click', function() {
		shell.openExternal('https://tonytony.club/tool/kaka/');
	})

	
	// 拖拽文件
	dragDrop(function (files) {
		var config = JSON.parse(LS.getItem('config'));
		var filesPath = handleReadyFiles(files);
		readyFilesPath.push.apply(readyFilesPath, filesPath);
		$('#js_execBtn').text('开始处理');

		// 拖拽处理模式
		if(config.useDragDo) {
			handFiles(filesPath, function (err) {
				$('#js_dropMask').addClass('none');
				$('#js_execBtn').text('重新处理');
			});
		}
	})

	// 点击处理模式
	$('#js_execBtn').on('click', function () {
		var $this = $(this);
		var config = JSON.parse(LS.getItem('config'));
		var _readyFilesPath = lodash.uniq(readyFilesPath);
		
		if(!config.useDragDo) {
			var _filesPath;
			if(_readyFilesPath.length > 0) {
				_filesPath = _readyFilesPath;
			} else {
				var _lastFilesPath = JSON.parse(LS.getItem('lastFiles'));
				if(_lastFilesPath) {
					_filesPath = _lastFilesPath.paths;
				}
			}
			if(_filesPath) {
				$this.text('处理中...')
				handFiles(_filesPath, function (err) {
					$('#js_dropMask').addClass('none');
					$('#js_execBtn').text('重新处理');
				});
			}
			
		}
	})


	// 处理通过系统窗口打开的文件
	$('#js_openFilesBtn').on('click', function () {
		$(this).tooltip('hide');
		handWindowFiles();
	})


	// F5处理最近一次文件文件操作
	$(document).bind('keyup',function(e){
	    if(e.keyCode === 116) {
	    	handLastFiles();
	    }
	});
	
})



// 处理通过系统窗口打开的文件
function handWindowFiles() {
	$('#js_openFilesBtn').unbind('click');

	dialog.showOpenDialog({
		filters: [
			{ name: 'All Files', extensions: ['*'] }
		],
		// properties: ['openFile','openDirectory','multiSelections','createDirectory']
		properties: ['openFile','multiSelections']
	}, function (fileNames) {
		
		if(fileNames) {
			// 获取文件信息
			fileNames.forEach(function (file) {
				readyWinFilesInfo.push({
					path : file,
					size : getFileSize(file)
				})
			})

			var config = JSON.parse(LS.getItem('config'));
			if(config.useDragDo) {
				var filesPath = handleReadyFiles(readyWinFilesInfo);
				// 执行处理文件
				handFiles(filesPath, function (err) {
					$('#js_dropMask').addClass('none');
				});
			} else {
				$('#js_execBtn').text('开始处理');
				var filesPath = handleReadyFiles(readyWinFilesInfo);
				// 更新待处理文件路径列表
				readyFilesPath.push.apply(readyFilesPath, filesPath);
			}
		}
		
		// 通过系统窗口打开文件(重新绑定事件)
		$('#js_openFilesBtn').on('click', function () {
			handWindowFiles();
		})
		.tooltip('hide')
		.on('mouseleave', function () {
			$(this).tooltip('hide')
		})
		
	})
}


/**
 * 待处理文件预处理
 *
 * @param  {Array} files
 * @param  {Function} cb
 * @return {Array}
 */
function handleReadyFiles(files) {
  var filesInfo = files;
  var $fileList = $('#js_fileList');

  $('#js_dropZone').addClass('drop-end');
  // 清除上次处理的log
  $('#js_logBox').html('');

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
  	// 路径标准化
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
  return filesPath;

}


// 使用nodejs接口同步获取文件尺寸
function getFileSize(filePath) {
	var stats = fs.statSync(filePath);
	return stats["size"];
}


// F5处理最近一次文件操作
function handLastFiles() {
	var lastFiles = JSON.parse(LS.getItem('lastFiles'));

	if(lastFiles) {
		$(document).unbind('keyup');
		$('#js_execBtn').text('处理中...')

		// 更新待文件处理信息，与最近一次操作文件保持一致
		var lastFilesText = '';
		lastFiles.text.forEach(function (item) {
			lastFilesText += '<li class="item">'+item+'</li>';
		})
		$('#js_fileList .file-list').html(lastFilesText);

		// 处理文件
		var lastFilesPath = lastFiles.paths;
		if(lastFilesPath.length > 0) {
			handFiles(lastFilesPath, function (err) {
				$('#js_execBtn').text('重新处理');
				$('#js_dropMask').addClass('none');
				
				// 重新绑定F5事件
				$(document).bind('keyup',function(e){
				    if(e.keyCode === 116) {
				    	handLastFiles();
				    }
				});
			});
		}

	}
}


// 处理文件
function handFiles(files, cb) {
	var start = +new Date();

	// 清空待处理文件数组
	readyFilesPath = [];
	readyWinFilesInfo = [];

	// 记录待处理的文件信息，供F5功能使用
	var lastFilesText = [];
	$('#js_fileList .item').each(function (item) {
		lastFilesText.push($(this).text());
	})
	var lastFiles = {
		text : lastFilesText,
		paths : files
	}
	LS.setItem('lastFiles', JSON.stringify(lastFiles));

	// 获取当前配置
	var config = JSON.parse(LS.getItem('config'));
	// console.log(config)

	// 处理时阻止事件遮罩
	$('#js_dropMask').removeClass('none');

	// 重置待处理文件信息
	$('#js_fileList').removeData('filesInfoData');

	// 清除上次处理的log
	$('#js_logBox').html('');

	// 提单详细
	var $summaryBox = $('#js_summaryBox');
	$summaryBox.addClass('none');

	// 开始处理文件
	kakaFiles(files, config, function (err, allFilesInfo) {
		var end =  +new Date();
		log('共耗时: '+ (end - start)/1000+'s', 'info');

		if(err) {
			if(cb) {
				cb(err);
			}
		} else {
			if(config.useFtp) {
				// 开始上传FTP
				log('开始上传文件到服务器... ', 'log');

				kakaUpload(allFilesInfo, function (err, result) {
					if(err) {
						if(cb) {
							cb(err);
						}
					} else {
						// 删除临时文件夹
						if(!config.saveLocal) {
							delTempDir(allFilesInfo, config);
						}

						// 显示提单详细数据
						if(result.bill.length > 0) {
							showDetail($summaryBox, result);
						}

						if(cb) {
							cb();
						}
					}
				})

				/*uploadFtp(allFilesInfo, function (err, ftpResults) {
					if(err) {
						if(cb) {
							cb(err);
						}
					} else {
						// 删除临时文件夹
						if(!config.saveLocal) {
							delTempDir(allFilesInfo, config);
						}

						// 显示提单详细数据
						if(ftpResults.bill.length > 0) {
							showDetail($summaryBox, ftpResults);
						}

						if(cb) {
							cb();
						}
					}

				})*/
			} else {
				if(cb) {
					cb();
				}
			}
		}

	})
}



// 显示提单详细数据
function showDetail(box, ftpResults) {
	box.removeClass('none');
    var $showBox = $('#js_showLogArea');
    $showBox.scrollTop($showBox[0].scrollHeight);
    var $detailPanel = $('#js_detailPanel');
    var $dropZone = $('#js_dropZone');

    // 详细文件地址
    var webHtml = '<h3>文件地址</h3>';
    var webSummaryHtml = '';
    ftpResults.web.forEach(function (item) {
		webHtml += '<p>'+item+'</p>';
		// HTML文件地址
		if(/\.html/.test(item)) {
			// 生成二维码
			var qrcodeImgHtml = createQrcode(item, 8, 'M');
			webSummaryHtml += '<div class="item"><div class="txt">'+item+'<span class="qrcode">'+qrcodeImgHtml+'</span></div><a href="javascript:;" class="btn-copy" data-placement="top" data-toggle="tooltip" data-original-title="复制" data-clipboard-text="'+item+'"></a></div>';
		}
	})

    var $webFilesShowBox = $('#js_webFilesShowBox');
    // 在log区显示HTML文件地址
	$webFilesShowBox.html(webSummaryHtml);
	// copy html地址
	$webFilesShowBox.find('.btn-copy').each(function () {
		var $this = $(this);
		var clipboard = new Clipboard($(this)[0]);
		clipboard.on('success', function(e) {
			$this.attr('data-original-title', '复制成功').tooltip('show')
			e.clearSelection();
	    });
	})
	$webFilesShowBox.on('mouseleave', '.btn-copy', function () {
		$(this).attr('data-original-title', '复制')
	})

	$webFilesShowBox.find('.txt').each(function () {
		$(this).on('click', function () {
			var url = $(this).text(); 
			if(!/http[s]?:\/\//.test(url)) {
				url = 'http://'+url;
			}
			shell.openExternal(url);
		})
	})

    // 详细提单路径
	var billHtml = '<h3>提单路径</h3>';
	ftpResults.bill.forEach(function (item) {
		billHtml += '<p>'+item+'</p>';
	})

    // 显示详细文件地址
    box.on('click', '#js_viewWeb', function () {
    	$(this).tooltip('hide');
    	$dropZone.addClass('show');
		$detailPanel.find('.inner').html(webHtml);
    })
    .on('mouseleave', '#js_viewWeb', function () {
    	$(this).tooltip('hide')
    })

    // 显示详细提单路径
    box.on('click', '#js_viewBill', function () {
    	$(this).tooltip('hide');
    	$dropZone.addClass('show');
		$detailPanel.find('.inner').html(billHtml);
    })
    .on('mouseleave', '#js_viewBill', function () {
    	$(this).tooltip('hide')
    })

    // 复制提单路径
    box.on('click', '#js_copyBill', function () {
    	var billList = ftpResults.bill.join('\n');
    	var $this = $(this);
		$this.attr('data-clipboard-text', billList);
		var clipboard = new Clipboard('#js_copyBill');
		clipboard.on('success', function(e) {
			$this.attr('data-original-title', '复制成功').tooltip('show')
			e.clearSelection();
	    });
    })
    .on('mouseleave', '#js_copyBill', function () {
    	$(this).attr('data-original-title', '复制')
    	$(this).tooltip('hide')
    })

    // 关闭详细面板
    $detailPanel.on('click', '.btn-close', function () {
    	$dropZone.removeClass('show');
    })
    $(document).keyup(function(e){
	    if(e.keyCode === 27) {
	    	$dropZone.removeClass('show');
	    }
	});
}



// 删除临时文件夹
function delTempDir(filesArr, opts) {
	var tempDir = [];
	var optDir = [];
	filesArr.forEach(function (file) {
		if(typeof file === 'string') {
			tempDir.push(getDirPath(file, true, opts));
			optDir.push(getDirPath(file, false, opts));
		} else {
			tempDir.push(getDirPath(file.savePath, true, opts));
			optDir.push(getDirPath(file.savePath, false, opts));
		}
	})

	tempDir = lodash.uniq(lodash.filter(tempDir, function (item) {
		return item != '';
	}))

	optDir = lodash.uniq(lodash.filter(optDir, function (item) {
		return item != '';
	}))

	var optDirNew = [];
	optDir.forEach(function (item) {
		var reg = new RegExp(opts.tempDir, 'i')
		if(!reg.test(item)) {
			optDirNew.push(item);
		}
	})

	var allDir = tempDir.concat(optDirNew);

	async.each(allDir, function (dirPath, callback) {
		if(fs.existsSync(dirPath)) {
			kakaRmdir(dirPath, function (err) {
				if(err) {
					callback(err);
				} else {
					callback();
				}
			})
		} else {
			callback();
		}
		
	}, function (err) {
		if(err) {
			log('删除临时文件夹出错: '+err.message, 'error');
			return;
		} else {
			log('临时文件夹删除成功!', 'log');
		}
	})

}


// 获取指定文件夹路径
function getDirPath(filePath, isTemp, opts) {
	var reg = isTemp ? new RegExp('(.*\/'+opts.tempDir+'\/)') : new RegExp('(.*\/'+opts.optimizedDir+'\/)');
	var match = reg.exec(filePath);
	var dirPath = match ? match[1] : '';
	
	return dirPath;
}


// 生成二维码图片
function createQrcode(text, typeNumber, errorCorrectLevel) {
	var qr = qrCode.qrcode(typeNumber || 4, errorCorrectLevel || 'M');
	qr.addData(text);
	qr.make();
	return qr.createImgTag();
};


/**
 * 数字转字节单位
 *
 * @param  {Number} num
 * @return {String}
 */
function prettyBytes(num) {
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
};






