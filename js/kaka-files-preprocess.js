'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var lodash = require('lodash');
var postcss = require('postcss');
var log = require('./log');


/**
 * 默认配置
 *
 * @type {Object}
 */
var defaults = {
	checkRelatedCss : false
};


/**
 * 主函数
 *
 * @param  {Array} files
 * @param  {Object} opts
 * @param  {Function} cb
 * @api public
 */
module.exports = function(files, opts, cb) {

	var options = lodash.merge({}, defaults, opts || {});
	
	// 文件分组
	var allFiles = filesGroup(files);

	// 文件中的css文件
	var cssFiles = allFiles.css.normal.concat(allFiles.css.importFiles);

	// 如果开启相关性检测
	if(options.checkRelatedCss) {

		handleRelatedCss(cssFiles, function (err, relatedInfo) {
			if(err) {
				if(cb) {
					cb(err);
				}
			} else {
				if(relatedInfo.length > 0) {
					// 所有写了@import并引入待处理文件的css文件
					var relatedPath = lodash.uniq(lodash.flatten(lodash.pluck(relatedInfo, 'relatedFiles')));

					// 把相关文件放入整体文件信息中待处理
					allFiles.css.normal = lodash.uniq(allFiles.css.normal.concat(relatedPath));

					// 显示相关文件信息
					relatedInfo.forEach(function (file) {
						log(file.fileName+' 相关文件:', 'info');
						file.relatedFiles.forEach(function (filePath) {
							log(filePath, 'log');
						})
					})
				} else {
					log('没有检测到相关文件', 'info')
				}
				
				if(cb) {
					cb(null, allFiles);
				}
			}

		})
	} else {
		if(allFiles.css.importFiles.length >0) {
			allFiles.css.importFiles.forEach(function (item) {
				log(item+ '是import样式，不做处理', 'warning')
			})
        }

		if(cb) {
			cb(null, allFiles);
		}
	}

};


/**
 * 文件分组
 *
 * @param  {Array} files
 * @param  {Object} opts
 * @return {Object}
 */
function filesGroup(files, opts) {
	var whiteList = 'php|jsp|asp|aspx|py|rb|java|pdf|txt|mp3|mp4|avi|eot|woff|woff2|ttf|otf|htc';
	var filesPath = {
		css : {
			importFiles: [],
			normal: []
		},
		img : {
			original: [],
			worked: []
		},
		html : [],
		js : [],
		whiteList: [],
		ignore : []
	};
	
	files.forEach(function(filePath){
		var extname = path.extname(filePath);

		if(extname == '.css') {
			// 处理xxx.import.css文件
			if(/\.import\.css$/.test(filePath)) {
				filesPath.css.importFiles.push(filePath);
			} else {
				filesPath.css.normal.push(filePath);
			}
		} else if(/\.(png|jpg|svg|gif|jpeg|GIF|JPG|JPEG|PNG)$/.test(extname)) {
			// 选出声明为.32的图片，不做压缩处理
			if(/\.\b32\b/.test(filePath)) {
				filesPath.img.worked.push(filePath);
			} else {
				filesPath.img.original.push(filePath);
			}
		} else if(extname == '.html') {
			filesPath.html.push(filePath);
		} else if(extname == '.js') {
			filesPath.js.push(filePath);
		} else {
			var fileTypeReg =new RegExp('.('+whiteList+')$');
			if(fileTypeReg.test(extname)) {
				filesPath.whiteList.push(filePath);
			} else {
				filesPath.ignore.push(filePath);
			}
		}
	});

	return filesPath;
}


/**
 * 找出以@import引用此css的所有其它css文件
 *
 * @param  {Array}  files
 * @param  {Function}  cb
 * @return async
 */
function handleRelatedCss(files, cb) {

	var dirGroups = checkDir(files);

	var allRelatedCssInfo = [];

	async.forEachOf(dirGroups, function (value, dirname, callback) {

		var checkFiles = lodash.pluck(value, 'filePath');

		checkTragetFile(checkFiles, dirname, function (err, relatedInfo) {
			if(err) {
				callback(err);
			} else {
				allRelatedCssInfo.push(relatedInfo);
				callback();
			}
			
		})

	}, function (err) {
		if(err) {
			if(cb) {
				cb(err)
			}
		} else {
			if(cb) {
				cb(null, trimRelatedInfo(files, lodash.flatten(allRelatedCssInfo)));
			}
		}
	})

}


/**
 * 整理所有的相关文件信息
 *
 * @param  {Array}  files
 * @param  {Array}  allRelatedCssInfo
 * @return {Array}
 */
function trimRelatedInfo(files, allRelatedCssInfo) {
	var relatedInfo = [];

	files.forEach(function (cssPath) {
		var file = {
			fileName : '',
			relatedFiles : []
		};
		allRelatedCssInfo.forEach(function (fileInfo) {
			if(cssPath == fileInfo.filePath) {
				file.fileName = fileInfo.fileName;
				file.relatedFiles.push(fileInfo.relatedCssPath);
			}
		})
		file.relatedFiles = lodash.uniq(file.relatedFiles);
		relatedInfo.push(file);
	})

	// 有相关性的文件信息
	relatedInfo = lodash.filter(relatedInfo, function (item) {
		return item.fileName != '';
	})

	return relatedInfo;
}


/**
 * 检测@import引入目标文件的所有文件
 *
 * @param  {Array}  files
 * @param  {String}  dirname
 * @param  {Function}  cb
 * @return {Boolean}
 */
function checkTragetFile(files, dirname, cb) {

	fs.readdir(dirname + '/', function (err, dirFiles){
		if (err) {
			log('检测相关性时，读取同目录文件夹出错: '+err.message, 'error');
			return;
		}

		// 找出css文件，剔除*.import.css文件，因为不支持import嵌套
		var readyCheckFiles = lodash.filter(dirFiles, function (name){
			if (/^(?!.*?\b\.import\b).*\.css$/.test(name)) {
				return name;
			}
		});
		
		var relatedInfo = [];

		async.forEachOf(readyCheckFiles, function (fileName, key, callback){
			var cssPath = path.resolve(dirname, fileName).split(path.sep).join('/');

			fs.readFile(cssPath, 'utf-8', function (err, data){
				if (err){
					callback(err);
				};

				try {
					var styleRoot = postcss.parse(data, {from: cssPath});

					// 找出文件中所有的@import文件
					var allImportPath = [];
					styleRoot.walkAtRules('import', function (atRule) {
						var importUrl = getImportUrl(atRule.params);
						// @import 文件绝对路径
						var importPath = path.resolve(dirname, importUrl).split(path.sep).join('/');
						allImportPath.push(importPath)
					})

					files.forEach(function (targetFilePath) {
						allImportPath.forEach(function (importPath) {
							if(targetFilePath == importPath) {
								var file = {
									fileName : path.basename(targetFilePath),
									filePath : targetFilePath,
									relatedCssPath : cssPath
								}
								relatedInfo.push(file);
							}
						})
					})

					callback();

				} catch (err) {
					callback(err);
				}

				
			})

		}, function (err) {
			if (err){
				if(err.name == 'CssSyntaxError') {
	                log('CSS语法错误: '+err.message+' ', 'error');
	            } else {
	                log('检测相关性时出错: '+err.message, 'error');
	            }
	            if(cb) {
					cb(err)
				}
			} else {
				if(cb) {
					cb(null, relatedInfo);
				}
			}
		});

	});
	
}


/**
 * 提取 @import 的url
 *
 * @param  {String} params
 * @return {String}
 */
function getImportUrl(params) {
	var match = /^(?:url\()?\s*['"]?\s*([^'"\s\)]+)\s*['"]?\s*\)?$/gi.exec(params);
	return match ? match[1] : '';
}


/**
 * 检测CSS文件的所在目录，返回目录分组
 *
 * @param  {Array}  files
 * @return {Object}
 */
function checkDir(files) {

	var allDirInfo = [];
	files.forEach(function (file) {
		var dirInfo = {
			dirPath : path.dirname(file).split(path.sep).join('/'),
			filePath : file
		};

		allDirInfo.push(dirInfo);
	})

	var groups = lodash.groupBy(allDirInfo, function (item) {
		return item.dirPath;
	})

	return groups;
}



