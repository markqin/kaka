'use strict';

// var Vue = require("./vendor/vue.min.js");
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
		kakaVersion : '0.2.1',
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
		// 是否使用拖拽处理模式
		useDragDo : true,
		// 是否使用FTP
		useFtp : false,
		// FTP配置
		ftpConfigs : [],
		// 不压缩JS
		noMinJS : false,
		// 不混淆JS
    	noMangleJS : false,
    	// CSS添加供JS获取的时间戳
    	jsTimeTag : false
	};
	
	if(!LS.config) {
		// initLS();
		LS.setItem('config', JSON.stringify(defaultSettings));
	} else {
		// 当前confog
		var config = JSON.parse(LS.getItem('config'));

		// 当前版本号
		var kakaVersion = '0.2.1';

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

		setUserName(config);
		setConfig(config);
		setTimestamp(config);
		setFtpInfo(config);
		
		// 绑定提示
		$('body').tooltip({
		    selector: '[data-toggle="tooltip"]',
		    container : 'body'
		});
		
	}
}


// 用户名
function setUserName(config) {
	var $userNameBox = $('#js_setUserName');

	if(config.userName == '') {
		try {
			var hostName = os.hostname().match(/\w+/)[0];
			if(hostName) {
				$userNameBox.val(hostName);
				config.userName = hostName;
				// LS.setItem('config', JSON.stringify(config));
			}
		} catch(err) {}
	} else {
		$userNameBox.val(config.userName);
	}

	$userNameBox.on('blur', function () {
		var _config = JSON.parse(LS.getItem('config'));
		var _name = $(this).val();
		_config.userName = _name;
		LS.setItem('config', JSON.stringify(_config));

		// 实时更新时间戳
		var now = kakaTime(_config);
		_config.timestamp = now;
		LS.setItem('config', JSON.stringify(_config));
		$('#js_setTime').find('.input-timeshow').val(now);
	})
}


// 时间戳
function setTimestamp(config) {
	var $timeBox = $('#js_setTime');
	var now = kakaTime(config);
	$timeBox.find('.input-timeshow').val(now);
	config.timestamp = now;
	LS.setItem('config', JSON.stringify(config));

	// 初始状态检测
	$timeBox.find('input[type=checkbox]').each(function () {
		var $this = $(this);
		var dataTag = $this.attr('data-tag');
		var dataState = $this.attr('data-state');
		var state = String(config[dataTag]);
		if(dataState != state) {
			$this.prop('checked','checked');
			$this.attr('data-state', state);
		}
	})

	// 更新时间戳
	$timeBox.on('click', '.btn-updata-time', function () {
		var _config = JSON.parse(LS.getItem('config'));
		var _now = kakaTime(_config);
		$timeBox.find('.input-timeshow').val(_now);
		_config.timestamp = _now;
		LS.setItem('config', JSON.stringify(_config));
	})

	// 手动自定义时间戳
	$timeBox.on('blur', '.input-timeshow', function () {
		var _config = JSON.parse(LS.getItem('config'));
		_config.timestamp = $(this).val();
		LS.setItem('config', JSON.stringify(_config));
	})

	// 选择是否使用时间戳
	$timeBox.on('click', 'input[type=checkbox]', function () {
		var _config = JSON.parse(LS.getItem('config'));
		var $this = $(this);
		var dataTag = $this.attr('data-tag');
		var state = !_config[dataTag];
		_config[dataTag] = state;
		$this.attr('data-state', state);
		var _now = $timeBox.find('.input-timeshow').val();
		_config.timestamp = _now;
		LS.setItem('config', JSON.stringify(_config));
	})
}


// 配置项
function setConfig(config) {
	var $normalBox = $('#js_setNormal');
	var $execBtn = $('#js_execBtn');

	// 初始状态检测
	$normalBox.find('input[type=checkbox]').each(function () {
		var $this = $(this);
		var dataTag = $this.attr('data-tag');
		var dataState = $this.attr('data-state');
		var state = String(config[dataTag]);
		if(dataState != state) {
			$this.prop('checked','checked');
			$this.attr('data-state', state);
		}
		// 拖拽即时处理模式
		if(dataTag == 'useDragDo') {
			if($this.attr('data-state') == 'true') {
				$execBtn.addClass('none');
			} else {
				$execBtn.removeClass('none');
			}
			
		}
	})

	// 配置项选择处理
	$normalBox.on('click', 'input[type=checkbox]', function () {
		var _config = JSON.parse(LS.getItem('config'));
		var $this = $(this);
		var dataTag = $this.attr('data-tag');
		var state = !_config[dataTag];
		_config[dataTag] = state;
		$this.attr('data-state', state);

		// 拖拽即时处理模式
		if(dataTag == 'useDragDo') {
			$execBtn.toggleClass('none');
		}

		LS.setItem('config', JSON.stringify(_config));
	})

}


// FTP配置
function setFtpInfo(config) {
	var $ftpMod = $('#js_ftp');
	var $ftpListWrap = $ftpMod.find('.ftp-list');

	// saveLocal初始状态检测
	$ftpMod.find('.local-item input[type=checkbox]').each(function () {
		var $this = $(this);
		var dataTag = $this.attr('data-tag');
		var dataState = $this.attr('data-state');
		var state = String(config[dataTag]);
		if(dataState != state) {
			$this.prop('checked','checked');
			$this.attr('data-state', state);
		}
	})

	// saveLocal状态切换
	$ftpMod.on('click', '.local-item input[type=checkbox]', function () {
		var _config = JSON.parse(LS.getItem('config'));
		var $this = $(this);
		var dataTag = $this.attr('data-tag');
		var state = !_config[dataTag];
		_config[dataTag] = state;
		$this.attr('data-state', state);

		LS.setItem('config', JSON.stringify(_config));
	})

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
		listHtml += '<li class="item item-ftp"><label class="inner"><input type="checkbox" '+isChecked+' tabindex="-1" data-tag="'+item.addTime+'" data-state="'+state+'"><span class="txt">'+item.name+'</span></label><span class="actions"><a href="javascript:;" tabindex="-1" class="btn-edit" data-placement="top" data-toggle="tooltip" data-original-title="编辑"></a><a href="javascript:;" tabindex="-1" class="btn-del" data-placement="top" data-toggle="tooltip" data-original-title="删除"></a></span></li>'
	});
	$ftpListWrap.append(listHtml);

	// 开启配置
	$ftpMod.on('click', '.btn-config', function () {
		$(this).toggleClass('clecked');
		if($(this).hasClass('clecked')) {
			$(this).attr('data-original-title','锁定配置')
		} else {
			$(this).attr('data-original-title','开启配置')
		}
		$(this).tooltip('hide');
		
		$ftpMod.toggleClass('config-enable');
	}).on('mouseleave', '.btn-config', function () {
		$(this).tooltip('hide');
	})

	// 选择ftp
	$ftpMod.on('click', '.item-ftp input[type=checkbox]', function () {
		var _config = JSON.parse(LS.getItem('config'));
		var $this = $(this);
		var dataTag = $this.attr('data-tag');
		$this.attr('data-state', 'false');

		_config.ftpConfigs.forEach(function (item) {
			if(item.addTime == dataTag) {
				var state = !item.current;
				item.current = state;
				$this.attr('data-state', String(state));
			} else {
				item.current = false;
			}
		})

		// 去掉其它ftp的选择状态
		$this.parents('.item-ftp').siblings('.item-ftp').find('input[type=checkbox]').prop('checked','').attr('data-state','false');

		// 检测是否有ftp选中
		if($(this).attr('data-state') == 'true') {
			_config.useFtp = true;
		} else {
			_config.useFtp = false;
		}

		LS.setItem('config', JSON.stringify(_config));
	})

	// 编辑ftp信息
	$ftpMod.on('click', '.btn-edit', function () {
		var _config = JSON.parse(LS.getItem('config'));
		var $parent = $(this).parents('.item-ftp');
		var dataTag = $parent.find('input[type=checkbox]').attr('data-tag');
		$parent.addClass('editing');
		$(this).tooltip('hide');

		// 显示待编辑的ftp信息
		_config.ftpConfigs.forEach(function (ftpConfig) {
			if(ftpConfig.addTime == dataTag) {
				$ftpMod.addClass('editing');
				$ftpMod.find('.js_btnOk').attr('data-tag',dataTag);

				lodash.forEach(ftpConfig, function (item, key) {
					if(typeof item === 'object') {
						item = item.join(',');
					}
					$ftpMod.find('.input').each(function () {
						var $this = $(this);
						var _tag = $this.attr('data-tag');
						if( _tag == key ) {
							$this.val(item)
						}
			 		})
				})
			}
		})
	})

	// 删除配置
	$ftpMod.on('click', '.btn-del', function () {
		var _config = JSON.parse(LS.getItem('config'));
		var $parent = $(this).parents('.item-ftp');
		var dataTag = $parent.find('input[type=checkbox]').attr('data-tag');

		// 删除相应的ftp信息
		var delIndex = NaN;
		lodash.forEach(_config.ftpConfigs, function (ftpConfig, key) {
			if(ftpConfig.addTime == dataTag) {
				delIndex = key;
				if(ftpConfig.current == true) {
					_config.useFtp = false;
				}
				return;
			}
		});
		if(delIndex != NaN) {
			_config.ftpConfigs.splice(delIndex, 1);
			LS.setItem('config', JSON.stringify(_config));
			// 去掉选择面板中的相应数据
			$parent.addClass('remove');
		}
		
	})
  
	// 添加ftp信息
	$ftpMod.on('click', '.btn-add', function () {
		$(this).tooltip('hide');
		$ftpMod.addClass('editing');
	})

	// 提交ftp信息
	$ftpMod.on('click', '.js_btnOk', function () {
		var _config = JSON.parse(LS.getItem('config'));
		var $this = $(this);
		var dataTag = $this.attr('data-tag');
		
		if(dataTag == '') {
			var requiredOK = true;
			// 获取添加的ftp配置信息
			var ftpConfigNew = {};
			$ftpMod.find('.input').each(function () {
				var $this = $(this);
				var _tag = $this.attr('data-tag');
				var _val = $this.val().trim();
				// 检测必填项
				if($this.attr('required') && _val == '') {
					requiredOK = false;
					$this.focus();
				}
				// 去除白名单列表中的空格
				if(_tag == 'wl') {
					_val = _val.replace(/\s+/g,'').split(',');
				}
				ftpConfigNew[_tag] = _val;
				ftpConfigNew['addTime'] = kakaTime();
				ftpConfigNew['current'] = false;
			})

			if(requiredOK) {
				// 存入localStorage
				_config.ftpConfigs.push(ftpConfigNew);
				// 在选择面板显示添加的ftp
				var html = '<li class="item item-ftp"><label class="inner"><input type="checkbox" tabindex="-1" data-tag="'+ftpConfigNew.addTime+'" data-state="false"><span class="txt">'+ftpConfigNew.name+'</span></label><span class="actions"><a href="javascript:;" class="btn-edit" data-placement="top" data-toggle="tooltip" data-original-title="编辑"></a><a href="javascript:;" class="btn-del" data-placement="top" data-toggle="tooltip" data-original-title="删除"></a></span></li>'
				$ftpMod.find('.ftp-list').append(html);
				LS.setItem('config', JSON.stringify(_config));
				// 重置
				$ftpMod.removeClass('editing');
				$ftpMod.find('.input').val('');
				$this.attr('data-tag','');
			}

		} else {
			// 更新修改的ftp
			_config.ftpConfigs.forEach(function (ftpConfig) {
				if(ftpConfig.addTime == dataTag) {
					var requiredOK = true;
					$ftpMod.find('.input').each(function () {
						var $this = $(this);
						var _tag = $this.attr('data-tag');
						var _val = $this.val().trim();
						// 检测必填项
						if($this.attr('required') && _val == '') {
							requiredOK = false;
							$this.focus();
						}
						if(_tag == 'wl') {
							_val = _val.replace(/\s+/g,'').split(',');
						}
						ftpConfig[_tag] = _val;
					})

					if(requiredOK) {
						$ftpMod.find('.item-ftp.editing .txt').text(ftpConfig['name']);
						LS.setItem('config', JSON.stringify(_config));
						// 重置
						$ftpMod.removeClass('editing');
						$ftpMod.find('.item-ftp').removeClass('editing');
						$ftpMod.find('.input').val('');
						$this.attr('data-tag','');
					}
				}
			})
		}
	})
	
	// 取消添加ftp
	$ftpMod.on('click', '.js_btnCancel', function () {
		$ftpMod.find('.input').val('');
		$ftpMod.find('.js_btnOk').attr('data-tag','');
		$ftpMod.find('.item-ftp').removeClass('editing');
		$ftpMod.removeClass('editing');
	})


}


