'use strict';
// set
var os = require('os');
var lodash = require('lodash');
var kakaTime = require('./js/kaka-timestamp');
var LS = localStorage;


//main
var time_load_start = +new Date();
// window.$ = window.jQuery = require("./js/vendor/jquery.min.js");

var shell = require('electron').shell;
var dialog = require('electron').remote.dialog; 
var fs = require('fs');
var path = require('path');
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
var kakaSprite = require('./js/kaka-css-sprite');
var kakaFilePre = require('./js/kaka-files-preprocess');
var kakaCSS = require('./js/kaka-handle-css');
var kakaImgMin = require('./js/kaka-image-minify');
var dragDrop = require('./js/drag-drop.js');
var uploadFtp = require('./js/upload-ftp.js');
var kakaUpload = require('./js/kaka-upload.js');
var log = require('./js/log.js');
var Clipboard = require("./js/vendor/clipboard.min.js");


var set = {
	_config_:{},
	defaultSettings: {
		// 版本号
		kakaVersion : '0.2.2',
		// 是否是移动模式
		mobileModel : true,
		// 检测css相关性
		checkRelatedCss : false,
		// 是否压缩图片
		doImageMinfy : true,
		// 临时文件夹名
		tempDir : '_kaka_temp',
		// sprite图文件夹名
		spriteDir : 'sprite',
		// 压缩图片的临时文件夹
		optimizedDir : '_kaka_optimized',
		// 用户名
		userName : '',
		// 文件时间戳
		timestamp : '',
		// 时间戳是否加上用户名标记
		timestampAddUserTag : false,
		// 是否使用时间戳
		useTimestamp : false,
		// 是否使用时间戳(CSS文件)
		useTimestampCss : false,
		// 是否文件保存在临时目录(暂时对图片压缩无效)
		saveLocal : false,
		// 是否替换原文件(图片压缩)
		replaceOriginal : false,
		// 是否同步资源
		syncResource : false,
		// 是否转@1x图
		to1x : false,
		// 是否使用FTP
		ftptag : [],//数组形式，vue要求的
		// FTP配置
		ftpConfigs : [],
		// ftpConfigs : [{"name":"102","addTime":"161017162644","current":false,"website":"http://ue.qzone.qq.com","host":"http://10.100.64.102/rz/task/","port":"21000","user":"ui-ars","pw":"isux!@#456","bill":"/usr/local/imgcache/htdocs","wl":["touch","mollyywang","brand","qz-act"]},{"name":"103","addTime":"161017162111","current":false,"website":"http://ue.qzone.qq.com","host":"http://10.100.64.102/rz/task/","port":"21000","user":"ui-ars","pw":"isux!@#456","bill":"/usr/local/imgcache/htdoc","wl":["touch","mollyywang","brand","qz-act"]}],
		// 不压缩JS
		noMinJS : false,
		// 是否使用拖拽处理模式
		useClickMode : false,
		// 不混淆JS
    	noMangleJS : false,
    	// CSS添加供JS获取的时间戳
    	jsTimeTag : false,
    	
    	ftp_editing : {
    		//是否正在编辑 0就是不在编辑状态，非0就是正在编辑的addTime,也就是之前的fata-tag
    		addTime:'',
    		name:'',
    		website:'',
    		current:false,
    		host:'',
    		port:'',
    		user:'',
    		pw:'',
    		bill:'',
    		wl:''
    	}
	},
	init:function(){
		var self = this;
		LS.removeItem('lastFiles');
		if(!LS.config) {
			initLS();
			LS.setItem('config', JSON.stringify(self.defaultSettings));
		} else {
			// 当前config
			// LS.setItem('config', JSON.stringify(defaultSettings));
			self._config_ = JSON.parse(LS.getItem('config'));
			// 当前版本号
			var kakaVersion = '0.2.2';
			if(self._config_.kakaVersion != kakaVersion) {
				var oldConfigKey = [];
				var newConfigKey = [];

				self._config_.kakaVersion = kakaVersion;

				lodash.forEach(self._config_, function(value, key) {
					oldConfigKey.push(key)
				});
				lodash.forEach(self.defaultSettings, function(value, key) {
					newConfigKey.push(key)
				})

				// 找出config增量
				var diff = oldConfigKey.filter(function(i){ 
					return !(newConfigKey.indexOf(i) > -1) 
				}).concat(newConfigKey.filter(function(i){ 
					return !(oldConfigKey.indexOf(i) > -1)
				}));

				// 更新config增量
				for(var i=0; i<diff.length; i++) {
					if(newConfigKey.indexOf(diff[i])>0) {
						self._config_[diff[i]] = self.defaultSettings[diff[i]];
					} else {
						delete self._config_[diff[i]];
					}
				}
				LS.setItem('config', JSON.stringify(self._config_));
			}

			//初始化绑定数据
			self.initData(self._config_);
			
			// 绑定提示
			$('body').tooltip({
			    selector: '[data-toggle="tooltip"]',
			    container : 'body'
			});
		}
	},

	kaka_info: function(){
		shell.openExternal('https://tonytony.club/tool/kaka/');
	},
	kaka_update: function(){
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
	},

	update_data:function(){
		var self = this;
		LS.setItem('config', JSON.stringify(self._config_));
		console.log(JSON.stringify(self._config_));
	},
	update_timestamp:function(){
		var self = this;
		var _now = kakaTime(self._config_);
		self._config_.timestamp = _now;
		this.update_data();
	},
	setTimestamp:function(){
		var self = this;
		var now = kakaTime(self._config_);
		self._config_.timestamp = now;
	},
	select_ftp:function(){
		var self = this;
		if(self._config_.ftptag.length>0){
			self._config_.ftptag[0] = self._config_.ftptag.pop();//拿最后一个,去掉其它ftp的选择状态
		}
		self._config_.ftpConfigs.forEach(function (item) {
			if(item.addTime == self._config_.ftptag) {
				item.current = true;
			} else {
				item.current = false;
			}
			
		})
		this.update_data();
	},
	//编辑ftp信息
	edit_ftp:function(dataTag,event){
		var self = this;
		self._config_.ftp_editing.addTime = dataTag;
		$(event.currentTarget).tooltip('hide');
		// 显示待编辑的ftp信息
		self._config_.ftpConfigs.forEach(function (ftpConfig) {
			if(ftpConfig.addTime == dataTag) {
				lodash.forEach(ftpConfig, function (item, key) {
					if(typeof item === 'object') {
						item = item.join(',');
					}
					self._config_.ftp_editing[key] = item;
			 	})
			}
		});
	},
	// 删除配置
	delete_ftp:function(dataTag,event){
		var self = this;
		// 删除相应的ftp信息
		var delIndex = NaN;
		lodash.forEach(self._config_.ftpConfigs, function (ftpConfig, key) {
			if(ftpConfig.addTime == dataTag) {
				delIndex = key;//保存要删除的ftp数组中的元素序号
				if(ftpConfig.current == true) {
					self._config_.ftptag = [];//空数组，表示不用ftp了
				}
				return;
			}
		});
		if(delIndex != NaN) {
			self._config_.ftpConfigs.splice(delIndex, 1);
			this.update_data();
			// 去掉选择面板中的相应数据
			$(event.currentTarget).parents('.item-ftp').addClass('remove');
		}
	},
	// 添加ftp信息
	add_ftp:function(event){
		var self = this;
		$(self._config_.ftpConfigs).tooltip('hide');
		self._config_.ftp_editing.addTime = kakaTime();
		self._config_.ftp_editing.current = false;
	},
	// 取消添加ftp
	cancel_ftp:function(){
		var self = this;
		self._config_.ftp_editing = {
    		addTime:'',
    		name:'',
    		website:'',
    		current:false,
    		host:'',
    		port:'',
    		user:'',
    		pw:'',
    		bill:'',
    		wl:''
    	}
	},
	// 提交ftp信息
	comfirm_ftp:function(){
		var self = this;
		var $ftpMod = $('#js_ftp');
		var $ftpListWrap = $ftpMod.find('.ftp-list');
		var isNew = true,//是否新增
			dataTag = self._config_.ftp_editing.addTime;


		self._config_.ftp_editing['wl'] = self._config_.ftp_editing['wl'].replace(/\s+/g,'').split(',');
		// 更新修改的ftp
		self._config_.ftpConfigs.forEach(function (ftpConfig) {
			if(ftpConfig.addTime == dataTag) {
				isNew = false;//是编辑，不是新增
				lodash.forEach(ftpConfig,function(item, key){
					ftpConfig[key] = self._config_.ftp_editing[key];
				})
				$('[value='+dataTag+']').next('span').text(self._config_.ftp_editing.name);
			}
		});
		if(!!isNew){
			self._config_.ftpConfigs.push(self._config_.ftp_editing);
			// 在选择面板显示添加的ftp
			var html = '<li class="item item-ftp"><label class="inner"><input type="checkbox" tabindex="-1" v-on:change="select_ftp"  v-model="config.ftptag" value='+self._config_.ftp_editing.addTime+' ><span class="txt">'+self._config_.ftp_editing.name+'</span></label><span class="actions"><a href="javascript:;" tabindex="-1" class="btn-edit" data-placement="top" data-toggle="tooltip" data-original-title="编辑" v-on:click="edit_ftp('+self._config_.ftp_editing.addTime+',$event)"></a><a href="javascript:;" tabindex="-1" class="btn-del" data-placement="top" data-toggle="tooltip" data-original-title="删除" v-on:click="delete_ftp('+self._config_.ftp_editing.addTime+',$event)" ></a></span></li>';
			$ftpListWrap.append(html);
			this.update_data();
		}
		this.cancel_ftp();//重置
		this.update_data();
	},

	initData:function (){
		var self = this;
		//setUserName用户名
		self._config_.userName = '';
		if(self._config_.userName == '') { 
			try {
				var hostName = os.hostname().match(/\w+/)[0];
				if(hostName) {
					self._config_.userName = hostName;
				}
			} catch(err) {}
		}
		// setTimestamp 时间戳
		console.log(JSON.stringify(self._config_));
		LS.setItem('config', JSON.stringify(self._config_));
		//FTP
		self.setFtpInfo(self._config_);
	},


	// FTP配置
	setFtpInfo:function () {
		var self = this;
		var $ftpMod = $('#js_ftp');
		var $ftpListWrap = $ftpMod.find('.ftp-list');

		// 显示已有ftp信息
		var listHtml = '';
		self._config_.ftpConfigs.forEach(function(item) {
			var isChecked = '';
			var state = 'false';
			if(item.current == true) {
				isChecked = 'checked';
				state = 'true';
				self._config_.useFtp = true;
			}
			listHtml += '<li class="item item-ftp"><label class="inner"><input type="checkbox" '+isChecked+' tabindex="-1" v-on:change="select_ftp"  v-model="config.ftptag" value='+item.addTime+' ><span class="txt">'+item.name+'</span></label><span class="actions"><a href="javascript:;" tabindex="-1" class="btn-edit" data-placement="top" data-toggle="tooltip" data-original-title="编辑" v-on:click="edit_ftp('+item.addTime+',$event)"></a><a href="javascript:;" tabindex="-1" class="btn-del" data-placement="top" data-toggle="tooltip" data-original-title="删除" v-on:click="delete_ftp('+item.addTime+',$event)" ></a></span></li>'
		});
		$ftpListWrap.append(listHtml);
	}
};
var main = {
	_control_:{
		execBtnText:'开始处理',
		dropMaskHide:true,
		$fileList:{
			filesInfoData:{
				filesInfo:[]
			},//待处理文件的的信息
			filesInfoHtml:[],//待处理文件的html
			readyFilesPath:[],//待处理文件的路径
		},
		dropEnd:false,
		summaryBoxHide:true,
		logHtml:''
	},
	init:function(){
		var time_load_end = +new Date();
		$('#js_pageMask').hide();
		log('模块预加载成功!', 'ok');
		log('共耗时: '+ (time_load_end - time_load_start)/1000+'s', 'info');
		this.bind_event();
	},
	bind_event:function(){
		var self = this;
		//中间核心功能
		// 拖拽文件
		dragDrop(function (files) {
			self.handleReadyFiles(files);//初始化处理文件
			self._control_.execBtnText = "开始处理";

			// 拖拽处理模式
			if(!set._config_.useClickMode) {
				self.handFiles(self._control_.$fileList.readyFilesPath,function (err) {
					self._control_.dropMaskHide = true;
					self._control_.execBtnText = '重新处理';
				});
			}
		});

		// F5处理最近一次文件文件操作
		$(document).bind('keyup',function(e){
		    if(e.keyCode === 116) {
		    	self.handLastFiles();
		    }
		});
	},
	openFiles:function($event){
		$(event.currentTarget).tooltip('hide');
		this.handWindowFiles();
	},
	// 点击处理模式
	exec_file:function(){
		var self = this,
		_readyFilesPath = lodash.uniq(self._control_.$fileList.readyFilesPath);
		
		if(set._config_.useClickMode) {
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
				self._control_.execBtnText = '处理中...';
				self.handFiles(_filesPath, function (err) {
					self._control_.dropMaskHide = true;
					self._control_.execBtnText = '重新处理';
				});
			}
		}
	},
	// 处理通过系统窗口打开的文件
	handWindowFiles:function ($event) {
		var self = this,readyWinFilesInfo = [];
		document.getElementById('js_openFilesBtn').removeEventListener ('click',function(){});
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
						size : self.getFileSize(file)
					})
				})
				if(!set._config_.useClickMode) {//拖拽模式
					self.handleReadyFiles(readyWinilesInfo);
					// 执行处理文件
					self.handFiles(readyFilesPath,function (err) {
						self._control_.dropMaskHide = true;
					});
				} else {
					self._control_.execBtnText = "开始处理";
					// 更新待处理文件路径列表
					self.handleReadyFiles(readyWinilesInfo);
					
				}
			}
			// 通过系统窗口打开文件
			document.getElementById('js_openFilesBtn').addEventListener('click', function () {
				self.openFiles();
			});
		})
	},
	/**
	 * 待处理文件预处理
	 *
	 * @param  {Array} files
	 * @param  {Function} cb
	 * @return {Array}
	 */
	handleReadyFiles: function(files) {
		var self = this;
	  	var filesInfo = files;//拖进来的文件
	  	this._control_.dropEnd = true;

		// 清除上次处理的log
		document.getElementById('js_logBox').innerHtml = "";

		// 取出暂存数据
		var nowFilesData = self._control_.$fileList.filesInfoData;
		if(nowFilesData.filesInfo.length) {
			//拖进来的文件跟原来的文件数据连接起来
			filesInfo = filesInfo.concat(nowFilesData.filesInfo);
		}

		// 数据去重
		var flags = {};
		var filesInfo = filesInfo.filter(function(item) {
		  if (flags[item.path]) {
		    return false;
		  }
		  flags[item.path] = true;
		  return true;
		});

		// 存入数据
		self._control_.$fileList.filesInfoData.filesInfo = filesInfo;

		var filesInfoHtml = [],filesPath = [];
		filesInfo.forEach(function (fileInfo) {
			// 路径标准化,存储
			var filePath = fileInfo.path.split(path.sep).join('/');
			filesPath.push(filePath);

			//html显示，存储
			var fileInfoHtml = filePath+' - (' + self.prettyBytes(fileInfo.size) + ')';
			filesInfoHtml.push(fileInfoHtml);
		})
 		
		self._control_.$fileList.readyFilesPath = filesPath;
		self._control_.$fileList.filesInfoHtml = filesInfoHtml;
		self._control_.summaryBoxHide = true;

		var $showBox = document.getElementById("js_showLogArea");
		$showBox.scrollTop = $showBox.scrollHeight;

	},

	// 处理文件
	handFiles: function(files,cb) {
		var start = +new Date(),self = this;
		var lastFiles = {
			text : self._control_.$fileList.filesInfoHtml,
			paths : self._control_.$fileList.readyFilesPath
		}

		LS.setItem('lastFiles', JSON.stringify(lastFiles));


		// 处理时阻止事件遮罩
		self._control_.dropMaskHide = true;

		// 重置待处理文件信息
		self._control_.$fileList.readyFilesPath = [];
		self._control_.$fileList.filesInfoHtml = [];
		self._control_.$fileList.filesInfoData = {filesInfo:[]};

		// 清除上次处理的log
		$('#js_logBox').html('');
		// self._control_.logHtml = '';
		self._control_.summaryBoxHide = true;
		// 提单详细
		// var $summaryBox = $('#js_summaryBox');//////////////
		// $summaryBox.addClass('none');

		// 开始处理文件
		kakaFiles(files, set._config_, function (err, allFilesInfo) {
			var end =  +new Date();
			log('共耗时: '+ (end - start)/1000+'s', 'info');

			if(err) {
				if(cb) {
					cb(err);
				}
			} else {
				if(set._config_.ftptag.length>0) {
					// 开始上传FTP
					log('开始上传文件到服务器... ', 'log');

					kakaUpload(allFilesInfo, function (err, result) {
						if(err) {
							if(cb) {
								cb(err);
							}
						} else {
							// 删除临时文件夹
							if(!set._config_.saveLocal) {
								self.delTempDir(allFilesInfo, set._config_);
							}

							// 显示提单详细数据
							if(result.bill.length > 0) {
								self.showDetail($summaryBox, result);
							}

							if(cb) {
								cb();
							}
						}
					})

					uploadFtp(allFilesInfo, function (err, ftpResults) {
						if(err) {
							if(cb) {
								cb(err);
							}
						} else {
							// 删除临时文件夹
							if(!config.saveLocal) {
								self.delTempDir(allFilesInfo, config);
							}

							// 显示提单详细数据
							if(ftpResults.bill.length > 0) {
								self.showDetail($summaryBox, ftpResults);
							}

							if(cb) {
								cb();
							}
						}

					})
				} else {
					if(cb) {
						cb();
					}
				}
			}

		})
	},

	// 使用nodejs接口同步获取文件尺寸
	getFileSize:function (filePath) {
		var stats = fs.statSync(filePath);
		return stats["size"];
	},

	// F5处理最近一次文件操作
 	handLastFiles: function() {
 		var self = this;
		var lastFiles = JSON.parse(LS.getItem('lastFiles'));

		if(lastFiles) {

			document.removeEventListener('keyup',function(){});
			self._control_.execBtnText='处理中...';
			// 更新待文件处理信息，与最近一次操作文件保持一致
			self._control_.$fileList.readyFilesPath = lastFiles.paths;
			self._control_.$fileList.filesInfoHtml = lastFiles.text;
			self._control_.summaryBoxHide = true;
			

			var $showBox = document.getElementById("js_showLogArea");
			$showBox.scrollTop = $showBox.scrollHeight;

			// 处理文件
			var lastFilesPath = lastFiles.paths;
			if(lastFilesPath.length > 0) {
				self.handFiles(lastFilesPath, function (err) {
					self._control_.execBtnText='重新处理';
					self._control_.dropMaskHide = true;
					
					// 重新绑定F5事件
					document.addEventListener('keyup',function(){
						if(e.keyCode === 116) {
					    	self.handLastFiles();
					    }
					})
				});
			}

		}
	},

	// 显示提单详细数据 /////
	showDetail: function(box, ftpResults) {
		var self = this;
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
				var qrcodeImgHtml = self.createQrcode(item, 8, 'M');
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
	},

	// 删除临时文件夹
	delTempDi: function(filesArr, opts) {
		var tempDir = [],optDir = [],self = this;
		filesArr.forEach(function (file) {
			if(typeof file === 'string') {
				tempDir.push(self.getDirPath(file, true, opts));
				optDir.push(self.getDirPath(file, false, opts));
			} else {
				tempDir.push(self.getDirPath(file.savePath, true, opts));
				optDir.push(self.getDirPath(file.savePath, false, opts));
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
	},

	// 获取指定文件夹路径
	getDirPath: function(filePath, isTemp, opts) {
		var reg = isTemp ? new RegExp('(.*\/'+opts.tempDir+'\/)') : new RegExp('(.*\/'+opts.optimizedDir+'\/)');
		var match = reg.exec(filePath);
		var dirPath = match ? match[1] : '';
		
		return dirPath;
	},

	// 生成二维码图片
	createQrcode: function(text, typeNumber, errorCorrectLevel) {
		var qr = qrCode.qrcode(typeNumber || 4, errorCorrectLevel || 'M');
		qr.addData(text);
		qr.make();
		return qr.createImgTag();
	},

	/**
	 * 数字转字节单位
	 *
	 * @param  {Number} num
	 * @return {String}
	 */
 	prettyBytes: function(num) {
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
	}
}

$(document).ready(function () {
	set.init();
	main.init();
	//vue 事件绑定
	var vm = new Vue({
		el: "#j-vue",
		data: {
			config:set._config_,
			control:main._control_
			},
		methods: {
			kaka_info: function(){
				set.kaka_info();
			},
			kaka_update: function(){
				set.kaka_update();
			},
			update_data:function(){
				set.update_data();
			},
			update_timestamp:function(){
				set.update_timestamp();
			},
			setTimestamp:function(){
				set.setTimestamp();
			},
			select_ftp:function(){
				set.select_ftp();
			},
			//编辑ftp信息
			edit_ftp:function(dataTag,event){
				set.edit_ftp(dataTag,event);
			},
			// 删除配置
			delete_ftp:function(dataTag,event){
				set.delete_ftp(dataTag,event);
			},
			// 添加ftp信息
			add_ftp:function(event){
				set.add_ftp(event);
			},
			// 取消添加ftp
			cancel_ftp:function(){
				set.cancel_ftp();
			},
			// 提交ftp信息
			comfirm_ftp:function(){
				set.comfirm_ftp();
			},
			exec_file:function(){
				main.exec_file();
			},
			openFiles:function(){
				main.openFiles();
			}
		}
	});
})












