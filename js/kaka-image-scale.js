'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var lodash = require('lodash');
var mime = require('mime');
var imageSize = require('image-size');
var log = require('./log');


/**
 * 主函数
 *
 * @param  {Array} files
 * @param  {Functon} cb
 * @api public
 */
module.exports = function (files, cb) {
	console.log('a'+files)

	var newFilesPath = [];

	async.forEachOf(files, function (imagePath, key, callback) {

		if(/\.(png|jpg|jpeg|JPG|JPEG|PNG)$/.test(imagePath)) {

			var ratio = getRetinaRatio(imagePath);

			if(ratio) {
				var size = imageSize(imagePath);
				var w = size.width, h = size.height;

				// 宽高必须都为偶数
				if(w%2 == 0 && h%2 ==0) {

					if(ratio != 3) {
						scaleImages(imagePath, w, h, ratio, function (err, newFilePath){
							if(err) {
								callback(err);
							} else {
								newFilesPath.push(newFilePath);
								callback();
							}
						});
					} else {
						// 对@3x图做一层检测
						if(w%3 == 0 && h%3 ==0) {
							scaleImages(imagePath, w, h, ratio, function (err, newFilePath){
								if(err) {
									callback(err);
								} else {
									newFilesPath.push(newFilePath);
									callback();
								}
							});
						} else {
							log(imagePath + ' @3x图宽或高不是3的整数倍，不做处理', 'warning');
							callback();
						}
					}

				} else {
					log(imagePath + ' retina图宽高不为偶数，不做处理', 'warning');
					callback();
				}
			} else {
				log(imagePath + ' 文件名中没有有@xx，不做处理', 'warning');
				callback();
			}
		} else {
			log(imagePath + ' 不支持的图片格式，不做处理', 'warning');
			callback();
		}

	}, function (err) {
		if(err) {
			log('retina图转@1x图时出错: '+err.message, 'error');
			return;
		} else {
			if(cb) {
				log('retina图转@1x图完成!' , 'ok')
				// 返回所有新生成的图片路径数组
				cb(lodash.uniq(newFilesPath));
			}
		}
		
	})

}


/**
 * 缩小图片
 *
 * @param  {String} imagePath
 * @param  {Number} w
 * @param  {Number} h
 * @param  {Number} ratio
 * @param  {Functon} cb
 * @return async
 */
function scaleImages(imagePath, w, h, ratio, cb) {
	// 保存路径
	var newFileName = path.basename(imagePath).replace('@'+ratio.toString()+'x','');
	var newFilePath = path.join(path.dirname(imagePath), newFileName).split(path.sep).join('/');

	// scale之后的尺寸
	var nW = Math.floor(w/ratio);
	var nH = Math.floor(h/ratio);

	// 创建canvas
	var canvas = document.createElement('canvas');
	canvas.width = nW;
	canvas.height = nH;
	var ctx = canvas.getContext('2d');
	var img = new Image();
	img.src = imagePath;

	img.onload = function () {
		ctx.imageSmoothingEnabled = true;
		ctx.drawImage(this, 0, 0, nW, nH);
		var imgData = canvas.toDataURL(mime.lookup(imagePath));
		var base64Data = imgData.replace('data:' + mime.lookup(imagePath) + ';base64,', '');
		var dataBuffer = new Buffer(base64Data, 'base64');

		// 保持@1x图
		fs.writeFile(newFilePath, dataBuffer, function (err) {
			if(err) {
				cb(err,null);
			} else {
				// 返回新文件路径(string)
				cb(null, newFilePath);
			}
		})
	}
}


/**
 * 获取retina的ratio值
 *
 * @param  {String} url
 * @return {Number}
 */
function getRetinaRatio(url) {
	var matche = /@(\d)x\.[a-z]{3,4}$/gi.exec(url);
	return matche ? lodash.parseInt(matche[1]) : 0;
}






