'use strict';

var fs = require('fs');
var async = require('async');
var lodash = require('lodash');
var log = require('./log.js');
var mkdirp = require('mkdirp');
var LS = localStorage;
var JSZip = require("jszip");
var needle = require('needle');



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


	var billPaths = [];
	var webPaths = [];
	var noFtpPathFiles = [];

	var zip = new JSZip();

	async.forEachOf(fileArr, function(file, key, callback){

		// string表示为待上传文件路径
		if (typeof file === 'string'){
			console.log(file)
			var ftpPath = parsePath(file, ftpCurrent.wl);
			console.log(ftpPath)
			if(ftpPath != '') {

				billPaths.push(ftpCurrent.bill+'/'+ftpPath);
				webPaths.push(ftpCurrent.website+'/'+ftpPath);

				
				zip.file(ftpPath, fs.readFileSync(file));

				callback();


			} else {
				noFtpPathFiles.push(file);
				callback();
			}
		} else {
			var ftpPath = parsePath(file.savePath, ftpCurrent.wl);
			if(ftpPath != '') {
				billPaths.push(ftpCurrent.bill+'/'+ftpPath);
				webPaths.push(ftpCurrent.website+'/'+ftpPath);

				zip.file(ftpPath, file.buffer);

				callback();

			} else {  
				noFtpPathFiles.push(file.savePath);
				callback();
			}
		}
	}, function(err) {
		if (err) {
			log('zip打包出错: '+err.message, 'error')
			if(cb) {
				cb(err)
			}
		} else {

			// 向API上传zip
			zip.generateAsync({type:"nodebuffer"})
				.then(function (content) {

					var data = {
						author: config.userName,
						zip: {
						    buffer       : content,
						    filename     : 'kaka-output.zip',
						    content_type : 'application/octet-stream'
						  }
					}

					if(ftpCurrent.host) {
						needle.post(ftpCurrent.host, data, { multipart: true }, function(err, resp, body) {
							if(err) {
								log('上传服务器端出错: '+err.message, 'error')
								if(cb) {
									cb(err)
								}
							} else {
								if(body.status) {
									
									if(noFtpPathFiles.length > 0) {
										log('===== 没有上传成功的文件 =====', 'warning');
										noFtpPathFiles.forEach(function (item) {
											log(item, 'log');
										})
										log('以上文件在服务器端没有对应关系目录，无法上传，请设置', 'warning');
									}

									log('文件全部上传成功!', 'ok');

									if(cb) {
										cb(null, {
											bill : billPaths,
											web : webPaths
										});
									}
								} else {
									log('服务器端出错 status: '+body.status, 'error')
								}
								
							}
						  	
						});
					}
					
				});

			
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
