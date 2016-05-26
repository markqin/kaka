'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var lodash = require('lodash');
var postcss = require('postcss');
var kakaSprite = require('./kaka-css-sprite');
var log = require('./log');


/**
 * 默认配置
 *
 * @type {Object}
 */
var defaults = {
	singleSpriteToken : '@kaka_sprite'
};

/**
 * 注册PostCSS插件
 *
*/
module.exports = postcss.plugin('kaka-css-import', main);


/**
 * 主函数
 *
 * @param  {Object}  opts
 * @return {Function}
 */
function main(opts) {
	var options = lodash.merge({}, defaults, opts || {});

	return function (css, result) {

		// 根据PostCSS API规则，异步处理必须返回Promise
    	return new Promise(function (resolve, reject) {

    		async.waterfall([
				// 获得@import文件初始信息
				function (cb) {
					cb(null, parseImportRule(css, options));
				},
				// 检测@import文件是否存在
				function (files, cb) {
					checkImportFileExist(files, function () {
						cb(null, files);
					})
				},
				// 解析@import文件内容
				function (files, cb) {
					parseImportContent(files, options, function (err) {
						cb(err, files);
					})
				},
				// 插入@import内容 (先将不需要sprite处理的*.import.css内容插入)
				function (files, cb) {
					insertImportContent(files, css, true);
					cb(null, files);
				},
				// 处理sprite
				function (files, cb) {
					handleSprite(files, css, options, function (err, spriteResult) {
						cb(err, files, spriteResult);
					})
				},
				// 一些非异步处理
				function (files, spriteResult, cb) {
					// 更新@import处理sprite后的相关数据
					mapImportData(files, spriteResult)

					// 插入@import内容 (sprite处理后的@import内容)
					insertImportContent(files, css, false);

					// 合并@media
					combinAtMedia(css);

					cb(null, lodash.flatten(lodash.pluck(spriteResult, 'images')))
				}
				
			], function (err, results) {
				if(err) {
					reject(err);
				} else {
					// 输出相关数据
	        		result.messages.push({
	        			// 输出所有背景图的路径
	        			images: results
	        		})
				    resolve();
				}
				
			});


    	})

	}

}


/**
 * 解析 @import rules
 *
 * @param {Object} css
 * @param {Object} opts
 * @return {Array}
 */
function parseImportRule(css, opts) {
	var styleFilePath = css.source.input.file;
	var styleDirPath = path.dirname(styleFilePath);
	var importFiles = [];

	css.walkAtRules('import', function (atRule) {
		var file = {
			url : null,
			path : null,
			content : '',
			root : null,
			isImport : false,
			needSprite : false,
			isIncludeImport : false,
			parentCss : path.basename(styleFilePath)
		};
		// @import 文件相对路径
		var importUrl = getImportUrl(atRule.params);

		if(importUrl) {
			var importPath = path.resolve(styleDirPath, importUrl);
			var importDirPath = path.dirname(importPath);

			// 只支持同级文件
			if(importDirPath == styleDirPath) {
				file.url = importUrl;
				file.path = importPath.split(path.sep).join('/');
				importFiles.push(file);
			} else {
				log(path.basename(styleFilePath)+' 中@import引入的 '+importUrl+' 不是同级文件，已被忽略', 'warning')
			}
		}
		
	})

	return importFiles;
}


/**
 * 检测@import文件是否存在
 *
 * @param  {Array} files
 * @param  {Function} cb
 * @return async
 */
function checkImportFileExist(files, cb) {

	var importFilesPath = lodash.pluck(files, 'path');

	// 找出不存在的文件
	async.filter(importFilesPath, function (item, callback){
		fs.exists(item, function (exists) {
			if(exists) {
				callback(false);
			} else {
				callback(true);
			}
		})
	}, function (results) {
		// 在文件信息数数组中删除不存在的文件
		results.forEach(function (filePath) {
			lodash.forEach(files, function (file) {
				if(file.path == filePath) {
					log(file.parentCss+' 中@import引入的 '+path.basename(filePath)+' 文件不存在，已被忽略', 'warning');
				}
			})

			lodash.remove(files, function (file) {
				return file.path == filePath;
			});
			
		});

		if(cb) {
			cb();
		}
		
	});

}


/**
 * 解析 @import 文件内容
 *
 * @param {Array} files
 * @param {Object} opts
 * @param {Function} cb
 * @return async
 */
function parseImportContent(files, opts, cb) {

	async.each(files, function (file, callback){
		var filePath = file.path;

		fs.readFile(filePath, function (err, buf) {
			if (err) {
				callback(err);
			} else {
				var styleContent = buf.toString();

				try {
					var styleRoot = postcss.parse(styleContent, { from: filePath});
					file.root = styleRoot;

					// 检测是否嵌套了@import文件
					styleRoot.walkAtRules('import', function (atRule) {
						if(atRule) {
							file.isIncludeImport = true;
							log(filePath+' 作为@import文件时不可以再嵌套@import文件，不做处理', 'warning')
						}
					});

					// 是否声明为单独处理sprite
					styleRoot.walkComments(function (comment) {
						if(comment.text == opts.singleSpriteToken) {
							file.needSprite = true;
							return;
						}
					});
					// 兼容CssGaga的声明
					if(!file.needSprite) {
						styleRoot.walkRules(function (rule) {
							// if(rule.selector == '#CssGaga'){}
							if(/#\s*CssGaga\s*{\s*background-image\s*:\s*none\s*}/gi.test(rule.toString())) {
								file.needSprite = true;
								return;
							}
						})
					}

					// 当此@import文件本身是 *.import.css 文件
					if(/\.import\./.test(filePath)) {
						file.isImport = true;		
					}

					file.content = styleContent;
					file.path = filePath;

					callback();

				} catch (err) {
					callback(err);
				}

			}
			
		})

	}, function (err) {
		if(err) {
			/*if(err.name == 'CssSyntaxError') {
                log('CSS语法错误: '+err.message+' ', 'error');
            } else {
                log('解析@import文件内容时出错: '+err.message, 'error');
            }*/
            log('解析@import文件内容时出错: '+err.message, 'error');
            if(cb) {
				cb(err);
			}
		} else {
			if(cb) {
				cb();
			}
		}
	})

}


/**
 * 处理sprite
 *
 * @param {Array} files
 * @param {Object} css
 * @param {Object} opts
 * @param {Function} cb
 * @return async
 */
function handleSprite(files, css, opts, cb) {
	var styleFilePath = css.source.input.file;
	// 传入根节点font-size
	opts.rootFontSize = getRootFontSize(css);

	// 需要执行sprite的@import文件
	var importFiles = lodash.filter(files, function (file) {
		return file.needSprite == true;
	});

	async.parallel([
		// 处理@import文件的sprite
		function (callback) {
			var importSpriteResult = [];

			async.forEachOf(importFiles, function (file, key, callback1){
				var importCssContent = file.content;
				var importPath = file.path;

				postcss([ kakaSprite(opts) ])
					.process(importCssContent, { from: importPath })
					.then(function (result) {
						var fileResult = {
							path : importPath,
							newContent : result.css,
							images : result.messages[0].images
						};
						importSpriteResult.push(fileResult);
						callback1();
					})
					.catch(function (err) {
	                    callback1(err);
	                })

			}, function (err) {
				if(err) {
					callback(err);
				} else {
					callback(null, importSpriteResult);
				}
			})
		},
		// 处理本文件的sprite
		function (callback) {
			postcss([ kakaSprite(opts) ])
				.process(css, { from: styleFilePath })
				.then(function (result) {
					var fileResult = {
						path : styleFilePath,
						newContent : result.css,
						images : result.messages[0].images
					};
					callback(null, fileResult);
				})
				.catch(function (err) {
                    callback(err);
                })
		}

	], function (err, results) {
		if(err){
			log('处理@import文件sprite时出错: '+ err.message, 'error');
			if(cb) {
				cb(err)
			}
		}
		if(cb) {
			cb(null, lodash.flatten(results));
		}
	})
	
}


/**
 * 更新@import处理sprite后的相关数据
 *
 * @param  {Array}  files
 * @param  {Array}  spriteResult
 */
function mapImportData(files, spriteResult) {

	spriteResult.forEach(function (item) {
		lodash.forEach(files, function (file) {
			if(file.path == item.path) {
				lodash.merge(file, {
					root: postcss.parse(item.newContent, { from: item.path})
				})
			}
		});
	})

}


/**
 * 插入 @import 内容
 *
 * @param {Array} files
 * @param {Object} css
 * @param {Boolean} isInit
 */
function insertImportContent(files, css, isInit) {
	var importFiles;
	if(isInit) {
		importFiles = lodash.filter(files, function (file) {
			return file.needSprite == false;
		})
	} else {
		importFiles = lodash.filter(files, function (file) {
			return file.needSprite == true;
		})
	}

	css.walkAtRules('import', function (atRule) {
		var importUrl = getImportUrl(atRule.params);

		lodash.forEach(importFiles, function (file) {
			// 找到相应的位置替换@import内容
			if(importUrl == file.url) {
				// postcss的replaceWith方法会替换掉decl前面的_*等hack字符串，要自己原生实现替换
				var newNodes = file.root.nodes;
				if (newNodes && newNodes.length) {
					newNodes[0].raws.before = atRule.raws.before
				}
				// keep AST clean
				newNodes.forEach(function(node) {
					node.parent = atRule.parent;
				})

				try {
					if(atRule.parent) {
						var nodes = atRule.parent.nodes;
						nodes.splice.apply(nodes, [ nodes.indexOf(atRule), 0 ].concat(newNodes));
						atRule.remove();
					}
					
				} catch (e) {
					log(e, 'error');
				}
				
			}
		})
		
	})

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
 * 合并@media
 *
 * @param  {Object} css
 */
function combinAtMedia(css) {
	var params = [
	  'only screen and (min--moz-device-pixel-ratio: 1.25)',
	  'only screen and (-webkit-min-device-pixel-ratio: 1.25)',
	  'only screen and (min-device-pixel-ratio: 1.25)',
	  'only screen and (min-resolution: 120dpi)',
	  'only screen and (min-resolution: 1.25dppx)'
	];

	var atParams = params.join(',');

	var mediaRule = postcss.atRule({
		name : 'media',
		params : atParams
	});

	var atRuleLen = 0;
	css.walkAtRules('media', function (atRule) {
		if(atRule.params == atParams) {
			atRuleLen += 1;
			mediaRule.append(atRule.nodes);
			atRule.remove();
		}
	})

	if(atRuleLen) {
		css.append(mediaRule);
	}
	
}

/*function combinAtMedia(css) {
	var allMediaInfos = [];

	css.walkAtRules('media', function (atRule) {
		allMediaInfos.push({
			params : atRule.params,
			nodes : atRule.nodes
		});
		atRule.remove();
	})

	var mediaGroups = lodash.groupBy(allMediaInfos, function (mediaInfo){
		return mediaInfo.params;
	});
	

	lodash.forEach(mediaGroups, function (mediaGroup, key) {
		var mediaRule = postcss.atRule({
			name : 'media',
			params : key
		});

		var allNodes = [];
		mediaGroup.forEach(function (item) {
			allNodes.push(item.nodes);
		})

		mediaRule.append(lodash.flatten(allNodes));

		css.append(mediaRule);

	})
	
}*/


/**
 * 得到根节点的font-size值
 *
 * @param  {Object} css
 * @return {Number}
 */
function getRootFontSize(css) {
	var rootFontSize = 16;

	css.walkRules(function (rule) {
		if(rule.selector == 'html') {
			rule.walkDecls(function (decl) {
				if(decl.prop == 'font-size') {
					rootFontSize = Number(decl.value.replace('px',''));
					return;
				}
			})
			return;
		}
	})

	return rootFontSize;
}

