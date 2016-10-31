'use strict';

var os = require('os');
var lodash = require('lodash');
var kakaTime = require('./kaka-timestamp');
var LS = localStorage;

// 主函数
module.exports = function() {

	// LS.clear()
	LS.removeItem('lastFiles');

	var defaultSettings = {
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
	};

	
	if(!LS.config) {
		initLS();
		LS.setItem('config', JSON.stringify(defaultSettings));
	} else {
	// 当前config
	// LS.setItem('config', JSON.stringify(defaultSettings));

	var config = JSON.parse(LS.getItem('config'));

	// 当前版本号
	var kakaVersion = '0.2.2';

	if(config.kakaVersion != kakaVersion) {
		var oldConfigKey = [];
		var newConfigKey = [];

		config.kakaVersion = kakaVersion;

		lodash.forEach(config, function(value, key) {
			oldConfigKey.push(key)
		});
		lodash.forEach(defaultSettings, function(value, key) {
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
				config[diff[i]] = defaultSettings[diff[i]];
			} else {
				delete config[diff[i]];
			}
		}
		LS.setItem('config', JSON.stringify(config));
	}

		//初始化绑定数据
		initData(config);
		
		// 绑定提示
		$('body').tooltip({
		    selector: '[data-toggle="tooltip"]',
		    container : 'body'
		});

		//绑定数据跟事件
		bindDataAndEvent(config);
		
	}
}

function bindDataAndEvent(config){
		// 顶部工具栏
		//vue 事件绑定
	var vmSet = new Vue({
		el: "#j-vue-set",
		data: config,
		methods: {
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
				LS.setItem('config', JSON.stringify(config));
				console.log(JSON.stringify(config));
			},
			update_timestamp:function(){
				var _now = kakaTime(config);
				config.timestamp = _now;
				this.update_data();
			},
			setTimestamp:function(){
				var now = kakaTime(config);
				config.timestamp = now;
			},
			select_ftp:function(){
				if(config.ftptag.length>0){
					config.ftptag[0] = config.ftptag.pop();//拿最后一个,去掉其它ftp的选择状态
				}
				config.ftpConfigs.forEach(function (item) {
					if(item.addTime == config.ftptag) {
						item.current = true;
					} else {
						item.current = false;
					}
					
				})
				this.update_data();
			},
			//编辑ftp信息
			edit_ftp:function(dataTag,event){
				config.ftp_editing.addTime = dataTag;
				$(event.currentTarget).tooltip('hide');
				// 显示待编辑的ftp信息
				config.ftpConfigs.forEach(function (ftpConfig) {
					if(ftpConfig.addTime == dataTag) {
						lodash.forEach(ftpConfig, function (item, key) {
							if(typeof item === 'object') {
								item = item.join(',');
							}
							config.ftp_editing[key] = item;
					 	})
					}
				});
			},
			// 删除配置
			delete_ftp:function(dataTag,event){
				// 删除相应的ftp信息
				var delIndex = NaN;
				lodash.forEach(config.ftpConfigs, function (ftpConfig, key) {
					if(ftpConfig.addTime == dataTag) {
						delIndex = key;//保存要删除的ftp数组中的元素序号
						if(ftpConfig.current == true) {
							config.ftptag = [];//空数组，表示不用ftp了
						}
						return;
					}
				});
				if(delIndex != NaN) {
					config.ftpConfigs.splice(delIndex, 1);
					this.update_data();
					// 去掉选择面板中的相应数据
					$(event.currentTarget).parents('.item-ftp').addClass('remove');
				}
			},
			// 添加ftp信息
			add_ftp:function(event){
				$(config.ftpConfigs).tooltip('hide');
				config.ftp_editing.addTime = kakaTime();
				config.ftp_editing.current = false;
			},
			// 取消添加ftp
			cancel_ftp:function(){
				config.ftp_editing = {
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
				var $ftpMod = $('#js_ftp');
				var $ftpListWrap = $ftpMod.find('.ftp-list');
				var isNew = true,//是否新增
					dataTag = config.ftp_editing.addTime;


				config.ftp_editing['wl'] = config.ftp_editing['wl'].replace(/\s+/g,'').split(',');
				// 更新修改的ftp
				config.ftpConfigs.forEach(function (ftpConfig) {
					if(ftpConfig.addTime == dataTag) {
						isNew = false;//是编辑，不是新增
						lodash.forEach(ftpConfig,function(item, key){
							ftpConfig[key] = config.ftp_editing[key];
						})
						$('[value='+dataTag+']').next('span').text(config.ftp_editing.name);
					}
				});
				if(!!isNew){
					config.ftpConfigs.push(config.ftp_editing);
					// 在选择面板显示添加的ftp
					var html = '<li class="item item-ftp"><label class="inner"><input type="checkbox" tabindex="-1" v-on:change="select_ftp"  v-model="ftptag" value='+config.ftp_editing.addTime+' ><span class="txt">'+config.ftp_editing.name+'</span></label><span class="actions"><a href="javascript:;" tabindex="-1" class="btn-edit" data-placement="top" data-toggle="tooltip" data-original-title="编辑" v-on:click="edit_ftp('+config.ftp_editing.addTime+',$event)"></a><a href="javascript:;" tabindex="-1" class="btn-del" data-placement="top" data-toggle="tooltip" data-original-title="删除" v-on:click="delete_ftp('+config.ftp_editing.addTime+',$event)" ></a></span></li>';
					$ftpListWrap.append(html);
					this.update_data();
				}
				this.cancel_ftp();//重置
				this.update_data();
			}
		}
	});
}

function initData(config){
	//setUserName用户名
	config.userName = '';
	if(config.userName == '') { 
		try {
			var hostName = os.hostname().match(/\w+/)[0];
			if(hostName) {
				config.userName = hostName;
			}
		} catch(err) {}
	}
	// setTimestamp 时间戳
	console.log(JSON.stringify(config));
	LS.setItem('config', JSON.stringify(config));
	//FTP
	setFtpInfo(config);
}


// FTP配置
function setFtpInfo(config) {
	var $ftpMod = $('#js_ftp');
	var $ftpListWrap = $ftpMod.find('.ftp-list');

	// 显示已有ftp信息
	var listHtml = '';
	config.ftpConfigs.forEach(function(item) {
		var isChecked = '';
		var state = 'false';
		if(item.current == true) {
			isChecked = 'checked';
			state = 'true';
			config.useFtp = true;
		}
		listHtml += '<li class="item item-ftp"><label class="inner"><input type="checkbox" '+isChecked+' tabindex="-1" v-on:change="select_ftp"  v-model="config.ftptag" value='+item.addTime+' ><span class="txt">'+item.name+'</span></label><span class="actions"><a href="javascript:;" tabindex="-1" class="btn-edit" data-placement="top" data-toggle="tooltip" data-original-title="编辑" v-on:click="edit_ftp('+item.addTime+',$event)"></a><a href="javascript:;" tabindex="-1" class="btn-del" data-placement="top" data-toggle="tooltip" data-original-title="删除" v-on:click="delete_ftp('+item.addTime+',$event)" ></a></span></li>'
	});
	$ftpListWrap.append(listHtml);
}


