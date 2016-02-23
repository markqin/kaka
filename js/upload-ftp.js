'use strict';

var fs = require('fs');
var async = require('async');
var lodash = require('lodash');
var log = require('./log.js');
var Client = require('ftp');
var LS = localStorage;


/**
 * 主函数
 *
 * @param  {Array}  fileArr
 * @return {Function}
 */
module.exports = function (fileArr, cb) {
	// 当前ftp配置
	var config = JSON.parse(LS.getItem('config'));
	var ftpCurrent = config.ftpConfigs.filter(function(item){
		return item.current == true;
	})[0];


	// 新建ftp连接
	var client = new Client();

	log('正在连接FTP服务器...', 'log');

	// 开始连接
	if(ftpCurrent) {
		client.connect({
			host: ftpCurrent.host,
			port: ftpCurrent.port,
			user: ftpCurrent.user,
			password: ftpCurrent.pw
		});
	} else {
		log('没有当前选中的FTP!(可能选中的被删除)', 'error');
		if(cb) {
			cb(true);
		}
	}
	

	// 连接成功后
	client.on('ready', function() {

		log('连接FTP服务器成功!', 'log');
		log('正在上传文件...', 'log');

		var billPaths = [];
		var webPaths = [];
		var noFtpPathFiles = [];

		async.forEachOf(fileArr, function(file, key, callback){
			// string表示为待上传文件路径
			if (typeof file === 'string'){
				var ftpPath = parsePath(file, ftpCurrent.wl);
				if(ftpPath != '') {
					uploader(client, file, ftpPath, function (err) {
						if(err) {
							callback(err);
						} else {
							billPaths.push(ftpCurrent.bill+'/'+ftpPath);
							webPaths.push(ftpCurrent.website+'/'+ftpPath);
							callback();
						}
					});
				} else {
					noFtpPathFiles.push(file);
					callback();
				}
			} else {
				var ftpPath = parsePath(file.savePath, ftpCurrent.wl);
				if(ftpPath != '') {
					uploader(client, file.buffer, ftpPath, function (err) {
						if(err) {
							callback(err);
						} else {
							billPaths.push(ftpCurrent.bill+'/'+ftpPath);
							webPaths.push(ftpCurrent.website+'/'+ftpPath);
							callback();
						}
					});
				} else {
					noFtpPathFiles.push(file.savePath);
					callback();
				}
			}
		}, function(err) {
			if (err) {
				log('上传FTP出错: '+err.message, 'error')
				if(cb) {
					cb(err)
				}
			} else {
				log('文件全部上传成功!', 'ok');

				if(noFtpPathFiles.length > 0) {
					log('===== 没有上传成功的文件 =====', 'warning');
					noFtpPathFiles.forEach(function (item) {
						log(item, 'log');
					})
					log('以上文件在ftp没有对应关系目录，无法上传，请设置', 'warning');
				}

				// 断开连接
				client.end();

				if(cb) {
					cb(null, {
						bill : billPaths,
						web : webPaths
					});
				}
			}
		})

	})

	// 断开连接时
	client.on('end', function(){
		log('FTP服务器断开连接', 'log')
	});

	// 获取全局ftp错误
	client.on('error', function(err){
		log('FTP服务器错误: '+err.message, 'error');
		if(cb) {
			cb(err);
		}
	});

}


/**
 * 上传文件
 *
 * @param  {Object} client
 * @param  {String/Buffer} localFile
 * @param  {String} ftpPath
 * @return {Function}
 */
function uploader(client, localFile, ftpPath, cb){
  // console.log("ftp path: " + ftpPath);

  client.put(localFile, ftpPath, function(err){
    if(err){
      // console.log(err);
      if( err.code === 553){
        var filePathArr = ftpPath.split('\/'),
            // ignore the file itself
            _filePath = filePathArr.splice(0, filePathArr.length-1).join('\/');

        client.mkdir(_filePath, true, function(err){
          if (err) {
            log('在FTP创建目标文件夹错误: '+err.message, 'error');
            if(cb) {
	    		cb(err);
	    	}
          } else{
            uploader(client, localFile, ftpPath);
          }
        });
      } else {
      	if(cb) {
    		cb(err);
    	}
      }
    } else {
    	if(cb) {
    		cb();
    	}
    }
  })
}


/**
 * 解析文件上传路径，获取在ftp服务器的路径
 *
 * @param  {String} localPath
 * @param  {Array} wlArr
 * @return {String}
 */
function parsePath(localPath, wlArr) {
	var pathArr = localPath.split('/');
	var savePath = '';

	// 去掉路径中的临时目录
	var newPathArr = pathArr.filter(function (item) {
		return !/_kaka_/.test(item);
	})

	// 根据对应关系白名单，得到文件在FTP服务器上相对于FTP根目录的保存路径
	if(typeof wlArr === 'object' && wlArr.length > 0) {
		lodash.forEach(newPathArr, function (item, key) {
			wlArr.forEach(function (wlItem) {
				if(item == wlItem) {
					savePath = newPathArr.slice(key).join('/');
				}
			})
		})
	}

	return savePath;
}








