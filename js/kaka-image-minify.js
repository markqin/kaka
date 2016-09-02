'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var lodash = require('lodash');
var gulp = require('gulp');
var gulpRename = require("gulp-rename");
var Imagemin = require('imagemin');
var imageminPngquant = require('imagemin-pngquant');
// var imageminWebp = require('imagemin-webp');
var log = require('./log');


/**
 * 默认配置
 *
 * @type {Object}
 */
var defaults = {
    replaceOriginal : false,
    optimizedDir : '_kaka_optimized'
};


/**
 * 主函数
 *
 * @param {Array} files
 * @param  {Object} opts
 * @param {Function} cb
 * @return async
 * @api public
 */
module.exports = function (files, opts, cb) {
	var options = lodash.merge({}, defaults, opts || {});

	var images = [];

	// 遍历图片数组
	async.forEachOf(files, function (file, key, callback){
		if(typeof file === 'string') {
			fs.readFile(file, function (err, buf) {
				if (err) {
					callback(err);
				} else {
					runImagemin(file, buf, options, function (err, imageInfo) {
						if(err) {
							callback(err);
						} else {
							images.push(imageInfo);
							callback();
						}
					})
				}
			});
		} else {
			if(typeof file === 'object') {
				runImagemin(file.savePath, file.buffer, options, function (err, imageInfo) {
					if(err) {
						callback(err);
					} else {
						images.push(imageInfo);
						callback();
					}
					
				})
			} else {
				callback();
			}
		}

	}, function (err){
		if (err) {
			log('图片压缩出错: '+err.message, 'error');
			if(cb) {
				cb(err)
			}
		} else {
			if(images.length>0) {
				var effectData = optimizedEffect(images);
				log('成功压缩了 '+images.length+' 张图片，共节省了'+effectData.save+' (-'+effectData.savePer+')', 'info');
			
				var doneImagesInfo = [];
				images.forEach(function (image) {
					doneImagesInfo.push({
						savePath : image.savePath,
						buffer : image.buffer
					})
				})

				if(cb) {
					// 返回压缩完的图片的信息
					cb(null, doneImagesInfo);
				}
			} else {
				if(cb) {
					// 返回压缩完的图片的信息
					cb(null, []);
				}
			}
		};
	});
};



/**
 * 压缩图片
 *
 * @param {String} filePath
 * @param {Buffer} buf
 * @param {Object} opts
 * @param {Function} cb
 * @return async
 */
function runImagemin(filePath, buf, opts, cb) {
	var optimizedDir = !opts.replaceOriginal ? opts.optimizedDir : '';
 
	new Imagemin()
		.src(buf)
		.use(gulpRename(path.basename(filePath)))
		.dest(path.join(path.dirname(filePath), optimizedDir))
		// .use(Imagemin.optipng({optimizationLevel: 1}))
		.use(imageminPngquant({quality: '90', speed: 1}))
		.use(Imagemin.jpegtran({progressive: true}))
		// .use(imageminWebp({quality: 75}))
		.use(Imagemin.svgo())
		.use(Imagemin.gifsicle({interlaced: true}))
		.run(function (err, data) {
			if(err) {
				if(cb) {
					cb(err)
				}
			} else {
				try {
					var imageInfo = { 
						path : filePath, 
						savePath : path.join(path.dirname(filePath), optimizedDir, path.basename(filePath)).split(path.sep).join('/'),
						orig : buf.length, 
						dest : data[0].contents.length,
						buffer : data[0].contents
					}
					if(cb) {
						cb(null, imageInfo)
					}
				} catch (err) {
					if(cb) {
						cb(err)
					}
				}
			}
			
			
		});
}


/**
 * 压缩优化效果
 *
 * @param  {Array} files
 * @return {String}
 */
function optimizedEffect(files) {
	// var diff = 0;
	var orig = 0;
	var dest = 0;
	files.forEach(function (file) {
		// diff += file.orig - file.dest;
		orig += file.orig;
		dest += file.dest;
	});
	var diff = orig-dest;
	return {
		save : prettyBytes(diff),
		savePer : Number(diff/orig*100).toFixed(2) + '%'
	}
}



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
