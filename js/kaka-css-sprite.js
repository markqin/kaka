'use strict';

var fs = require('fs');
var path = require('path');
var async = require('async');
var lodash = require('lodash');
var postcss = require('postcss');
var spritesmith = require('spritesmith');
var mkdirp = require('mkdirp');
var mime = require('mime');
var imageSize = require('image-size');
var kakaImageMin = require('./kaka-image-minify');
var log = require('./log');
var kakaTime = require('./kaka-timestamp');


/**
 * 默认配置
 *
 * @type {Object}
 */
var defaults = {
	tempDir : '',
	spriteDir : 'sprite',
	saveLocal : true,
	mobileModel : false,
	doImageMinfy : true,
	timestamp : '',
	useTimestampSprite : true,
	noSpriteBgImgNewName: true
};


/**
 * 注册PostCSS插件
 *
*/
module.exports = postcss.plugin('kaka-css-sprite', main);

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
				// 获取所有background(-image)图片相关信息
				function (cb) {
					cb(null, getImages(css));
				},
				// 检测背景图是否存在
				function (images, cb) {
					checkImageExist(images, css, function () {
						cb(null, images);
					})
				},
				// 检测@1x图片同级目录的retina图片(只支持@2x图检索)
				function (images, cb) {
					checkRetinaImageExist(images, function () {
						cb(null, images);
					});
				},
				// 一些非异步处理
				function (images, cb) {
					// 检测retina图的宽高是否都是偶数
					checkRetinaImageEvenSize(images);

					// 用注释tokens替换对应的图片地址
					setTokens(images, css);

					cb(null, images);
				},
				// 处理base64图片
				function (images, cb) {
					handleBase64(images, options ,function (base64Info) {
						// 为每个图片添加base64相关数据
						mapBase64(images, base64Info);

						cb(null, images);
					})
				},
	        	// 用spritesmith处理合成sprite图
			    function (images, cb) {
			    	runSpriteSmith(images, options, function (spritesData) {
			    		cb(null, images, spritesData);
			    	});
			    },
			    // 写入生成的sprite图片
			    function (images, spritesData, cb) {
			    	saveSprites(css, images, options, spritesData, function (spriteImagesInfo) {
		        		cb(null, images, spritesData, spriteImagesInfo);
			    	});
			        
			    },
			    // 生成sprite图后的相关处理
				function (images, spritesData, spriteImagesInfo, cb) {
					// 为每个图片添加sprite相关数据
	        		mapSpritesData(images, spritesData);

	        		// 替换相关background属性为sprite图
	        		updateSpriteRef(images, spritesData, css, options);

	        		// 替换非sprite图的background属性
	        		updateNormalRef(images, css, options);

	        		// 替换相关background属性为base64
							updateBase64Ref(images, css, options);

	        		// 生成@1x图对应retina图的media query样式
	        		updateMediaQuery(images, spritesData, css, options);

	        		// 非sprite背景图新文件名
	        		setBgImageNewFileName(images, css, options);

		        	// 返回所有背景图信息
		        	/*var allImagesInfo = {
		        		// sprite图信息
		        		sprite : spriteImagesInfo,
		        		// 所有非sprite背景图的路径
		        		normal : getNoSpriteImagesPath(images)
		        	}*/
		        	spriteImagesInfo.push.apply(spriteImagesInfo, getNoSpriteImagesPath(images));

		        	cb(null, spriteImagesInfo);
				}
			], function (err, results) {
				if(err) {
					log('sprite图处理阶段出错: '+err.message, 'error');
					return;
				}
				// 输出相关数据
        		result.messages.push({
        			// 输出所有背景图信息
        			images: results
        		})
			    resolve();
			});

        });

    };
}


/**
 * 获取所有background(-image)图片相关信息
 *
 * @param  {Object} css
 * @return {Array}
 */
function getImages(css) {
	var images = [];
	var styleFilePath = css.source.input.file;

	// 遍历rule，找出符合相关条件的，以合成sprite图:(background-image:xxx/slice/xxx)
	css.walkDecls(/^background(-image)?$/, function(decl) {
		var rule = decl.parent;
		var declString = decl.toString();
		
		// 图片信息
		var image = {
			url     	: null,
			path    	: null,
			pathRetina	: null,
			retina  	: false,
			ratio   	: 1,
			has_1x	  	: false,
			token   	: '',
			sprite  	: false,
			rem 		: false,
			base64 		: false,
			typeGroup 	: '',
			selector	: ''
		};

		// 只处理符合background(-image)规则的decl
		if(hasImageInRule(declString)) {
			// sprite图
			if (hasSliceImageInRule(declString)) {
				image.url = getSliceImageUrl(declString);
				image.sprite = true;
			// 非sprite图
			} else { 
				image.url = getImageUrl(declString);
			}

			var _imageDirname = path.dirname(image.url);
			var _imageBasename = path.basename(image.url);

			// 自定义图片设置(?rem&base64)
			/*var customSet = getCustomSet(image.url);
			if(customSet != ''){
				if(/base64/.test(customSet)) {
					image.base64 = true;
				}
				image.url = image.url.replace(customSet,'');
			}*/

			// 是否是rem文件夹的图片
			if(/\/?\brem\b\/?/.test(_imageDirname)) {
				image.rem = true;
			}

			// 是否是base64文件夹的图片
			if(/\/?\bbase64\b\//.test(_imageDirname)) {
				image.base64 = true;
			}

			// 是否是.32图片
			if(/\.32\b/.test(_imageBasename)) {
				image.typeGroup = '32';
			}

			// 是否是ie6图片
			if(/\bie6\b/.test(_imageBasename)) {
				image.typeGroup = 'ie6';
			}

			// 图片绝对路径
			image.path = path.resolve(path.dirname(styleFilePath), image.url).split(path.sep).join('/');

			// 是否直接使用了ritina图
			if(isUseRetinaImage(image.path)) {
				image.retina = true;
				image.ratio = getRetinaRatio(image.path);
				image.pathRetina = image.path;
				image.path = null;
			} else{
				// 使用了1x图
				image.has_1x = true;
			}

			// 图片的选择器class
			image.selector = rule.selector;

			images.push(image);
		}
	});

	return images;
}


/**
 * 检测图片是否存在
 *
 * @param  {Array} images
 * @param  {Object} css
 * @param  {Function} cb
 * @return async
 */
function checkImageExist(images, css, cb) {
	var styleFilePath = css.source.input.file;

	// 所有图片的路径
	var imagesPath = lodash.uniq(lodash.filter(
		lodash.pluck(images, 'path').concat(lodash.pluck(images, 'pathRetina')), function (img) {
			return img != null;
		}
	));

	// 找出不存在的图片
	async.filter(imagesPath, function (item, callback){
		fs.exists(item, function (exists) {
			if(exists) {
				callback(false);
			} else {
				callback(true);
			}
		})
	}, function (results) {
		// 在图片信息数组中删除不存在的图片
		results.forEach(function (imgPath) {
			log(imgPath+' 图片不存在 (在'+path.basename(styleFilePath)+'中)', 'warning')
			lodash.remove(images, function (img) {
				return img.pathRetina == imgPath || img.path == imgPath;
			});
		});

		if(cb) {
			cb();
		}
		
	});

}


/**
 * 检测@1x图片同级目录的retina图片(只支持@2x图检索)
 *
 * @param  {Array} images
 * @param  {Function} cb
 * @return async
 */
function checkRetinaImageExist(images, cb) {

	// 所有@1x图(除了.ie6图)
	var allImages = lodash.filter(images, function (img) {
		return img.has_1x == true && img.typeGroup != 'ie6';
	});

	async.each(allImages, function (image, callback) {
		var matche = /(\.[a-z]{3,4})$/gi.exec(image.path);
		if(matche) {
			// @2x路径
			var retinaUrl = image.path.replace(matche[0],'@2x'+matche[1]);

			fs.exists(retinaUrl, function (exists) {
				if(exists) {
					image.retina = true;
					image.ratio = 2;
					image.pathRetina = retinaUrl;
				}
				callback();
			});
		} else {
			callback();
		}
		
	}, function (err) {
		if(err) {
			log('检测@1x图同级目录的@2x图时出错: '+err.message, 'error');
			return err;
		} else {
			if(cb) {
				cb();
			}
		}
		
	});	
}


/**
 * 检测retina图的宽高是否都是偶数
 *
 * @param  {Array} images
 */
function checkRetinaImageEvenSize(images) {
	// 不处理宽高不为偶数的图片
	lodash.remove(images, function (img) {
		if(img.pathRetina != null) {
			var size = imageSize(img.pathRetina);
			var w = size.width, h = size.height;
			if(w%2 != 0 || h%2 !=0) {
				if(img.has_1x) {
					log(img.pathRetina + ' retina图宽高不为偶数，不做sprite处理', 'warning');
					img.pathRetina = null;
					img.retina = false;
					img.ratio = 1;
					return false;
				} else {
					return true;
				}
			}
		}
	});
}


/**
 * 用注释tokens替换对应的图片地址
 *
 * @param  {Array} images
 * @param  {Object} css
 */
function setTokens(images, css) {

	css.walkDecls(/^background-image$/, function(decl) {
		var rule = decl.parent;
		var declString = decl.toString();

		// 只操作有slice图片的rule
		if ( hasSliceImageInRule(declString) ) {
			var url = getSliceImageUrl(declString);
			// url = url.replace(getCustomSet(url),'');

			// 找到有相应url的图片
			var allImages = lodash.filter(images, function (img) {
				return img.url == url && img.base64 == false;
			});

			lodash.forEach(allImages, function (image) {
				// 删除原有的背景图属性
				rule.walkDecls(/^background-(repeat|size|position)$/, function(decl) {
					decl.remove();
				});

				// 记录token
				image.token = postcss.comment({
					text: image.url,
				});

				image.token.raws.before = ' \n';
				image.token.raws.left   = '@replace|';
				image.token.raws.right  = '';

				decl.replaceWith(image.token);
			});

		}
	});

}


/**
 * 运行spritesmith处理图片
 *
 * @param  {Array}  images
 * @param  {Object} opts
 * @param  {Function} cb
 * @return async
 */
function runSpriteSmith(images, opts, cb) {

	// 执行spritesmith
	async.parallel([
		// @1x图合并sprite
		function (callback) {
			doNormalSprite(images, false, opts, function (err, result) {
				if(err) {
					callback(err);
				} else {
					callback(null, result);
				}
			});
		},
		// rem @1x图合并sprite
		function (callback) {
			doNormalSprite(images, true, opts, function (err, result) {
				if(err) {
					callback(err);
				} else {
					callback(null, result);
				}
			});
		},
		// retina图合并sprite
		function (callback) {
			doRetinaSprite(images, false, opts, function (err, result) {
				if(err) {
					callback(err);
				} else {
					callback(null, result);
				}
			});
		},
		// rem retina图合并sprite
		function (callback) {
			doRetinaSprite(images, true, opts, function (err, result) {
				if(err) {
					callback(err);
				} else {
					callback(null, result);
				}
			});
		}

	], function (err, results) {
		if(err){
			log('合成sprite图出错: '+ err.message, 'error');
			return;
		}
		if(cb) {
			// 返回所有sprite图的信息数组
			var spritesData = lodash.filter(lodash.flatten(results), function (item) {
				return item != null;
			})
			cb(spritesData);
		}
		
	});
}


/**
 * 处理@1x图的sprite合成
 *
 * @param  {Array}  images
 * @param  {String}  type
 * @param  {Object} opts
 * @param  {Function} cb
 * @return async
 */
function doNormalSprite(images, isRem, opts, callback) {
	var allImages;
	if(opts.mobileModel) {
		allImages = lodash.filter(images, function (img) {
			if(!isRem) {
				return img.has_1x == true && img.retina == false && img.sprite == true && img.rem == false && img.base64 == false;
			} else {
				return img.has_1x == true && img.retina == false && img.sprite == true && img.rem == true && img.base64 == false;
			}
		});
	} else {
		allImages = lodash.filter(images, function (img) {
			if(!isRem) {
				return img.has_1x == true && img.sprite == true && img.rem == false && img.base64 == false;
			} else {
				return img.has_1x == true && img.sprite == true && img.rem == true && img.base64 == false;
			}
		});
	}

	if(allImages.length > 0) {

		// 按照'.32' '.ie6' 等后缀分组
		var typeGroups = lodash.groupBy(allImages, function (img){
			return img.typeGroup;
		});

		var results = [];

		async.forEachOf(typeGroups, function (typeGroup, key, callback1){
			var src = lodash.filter(lodash.pluck(typeGroup, 'path'), function (img) {
				return img != null;
			});

			// spritesmith配置
			var config = lodash.merge({}, opts, {
				src: lodash.uniq(src),
				padding: 1
			});

			spritesmith.run(config, function (err, result) {
				if(err){
					callback1(err);
				} else {
					// 分组
					result.types = lodash.pluck(typeGroup, 'typeGroup')[0];
					result.groups = '';
					results.push(result);
					result.rem = isRem;

					callback1();
				}
				
			});
		}, function (err){
			if(err){
				callback(err)
			} else {
				callback(null, results);
			}
		});

	} else {
		callback(null, null);
	}

}


/**
 * 处理retina图的sprite合成
 *
 * @param  {Array}  images
 * @param  {String}  type
 * @param  {Object} opts
 * @param  {Function} cb
 * @return async
 */
function doRetinaSprite(images, isRem, opts, callback) {

	var allImages = lodash.filter(images, function (img) {
		if(!isRem) {
			return img.retina == true && img.sprite == true && img.rem == false && img.base64 == false;
		} else {
			return img.retina == true && img.sprite == true && img.rem == true && img.base64 == false;
		}
	});

	// 按照'.32' '.ie6' 等后缀分组
	var typeGroups = lodash.groupBy(allImages, function (img){
		return img.typeGroup;
	});

	var results = [];

	async.forEachOf(typeGroups, function (typeGroup, key, callback1){

		// retina图按照ratio分组
		var ratioGroups = lodash.groupBy(typeGroup, function (img){
			return img.ratio;
		});

		var ratioResults = [];

		async.forEachOf(ratioGroups, function (group, key, callback2){
			var src = lodash.filter(lodash.pluck(group, 'pathRetina'), function (img) {
				return img != null;
			});

			// 按ratio分组
			var ratioGroupTag = lodash.pluck(group, 'ratio')[0];

			// 设置sprite图中每张图之间的padding
			var padding = 0;
			if(ratioGroupTag % 2 == 0) {
				padding = !isRem ? 2 : 4;
			} else {
				padding = !isRem ? 3 : 6;
			}

			// spritesmith配置
			var config = lodash.merge({}, opts, {
				src: lodash.uniq(src),
				padding: padding
			});

			spritesmith.run(config, function (err, result) {
				if(err){
					callback2(err);
				} else {
					// 分组
					result.types = lodash.pluck(typeGroup, 'typeGroup')[0];
					result.groups = '@'+ratioGroupTag.toString()+'x';
					ratioResults.push(result);
					result.rem = isRem;

					callback2();
				}
				
			});
		}, function (err){
			if(err){
				callback1(err)
			} else {
				results.push(ratioResults);
				callback1();
			}
		});

	}, function (err) {
		if(err){
			callback(err)
		} else {
			callback(null, lodash.flatten(results));
		}
	})

	
}


/**
 * 写入生成的sprite图片
 *
 * @param  {Array}  images
 * @param  {Object} opts
 * @param  {Array}  sprites
 * @param  {Function}  cb
 * @return async
 */
function saveSprites(css, images, opts, sprites, cb) {
	var styleFilePath = css.source.input.file;
	// sprite图目录路径
	var spriteDirPath = path.join(path.dirname(styleFilePath), opts.tempDir, opts.spriteDir);

	// 创建写入sprite图的目录
	if (opts.saveLocal && !fs.existsSync(spriteDirPath)) {
		mkdirp.sync(spriteDirPath);
	}

	// 所有sprite图的信息
	var spriteImagesInfo = [];

	async.forEachOf(sprites, function (sprite, key, callback){
		// 是否加.32后缀
		var types = sprite.types != '' ? '.'+sprite.types : '';

		// 时间戳
		var timestamp = opts.useTimestampSprite ? '-'+opts.timestamp : '';

		// rem
		var rem = sprite.rem ? '.rem' : '';

		// 文件名
		var basename = path.basename(styleFilePath,'.css');
		if(/\.import\b/.test(basename)) {
			basename =basename.replace('import', 'imp');
		}

		// sprite图文件名
		var spriteName = basename+timestamp+rem+types+sprite.groups+'.png';
		// 保存路径
		sprite.path = path.join(spriteDirPath, spriteName).split(path.sep).join('/');

		var spriteInfo = {
			savePath : sprite.path,
			buffer : sprite.image
		}

		spriteImagesInfo.push(spriteInfo);

		// 写入sprite图
		if(opts.saveLocal) {
			fs.writeFile(sprite.path, sprite.image, function (err) {
				if (err) {
					callback(err);
				}
				callback();
			});
		} else {
			callback();
		}
		
	}, function (err) {
		if(err) {
			log('写入sprite图出错: '+ err.message, 'error');
			return;
		}
		if(cb) {
			// 返回所有sprite图的信息
			cb(spriteImagesInfo);
		}
	});

}


/**
 * 为每个图片添加sprite相关数据
 *
 * @param  {Array}  images
 * @param  {Array}  sprites
 */
function mapSpritesData(images, sprites) {
	lodash.forEach(sprites, function (sprite) {
		lodash.forEach(sprite.coordinates, function (coordinates, imagePath) {

			// 找到有相应url的图片
			var normalImages = lodash.filter(images, function (img) {
				return img.path == imagePath;
			});
			var retinaImages = lodash.filter(images, function (img) {
				return img.pathRetina == imagePath;
			});

			lodash.forEach(normalImages, function (image) {
				lodash.merge(image, {
					coordinates: coordinates,
					spritePath: sprite.path,
					properties: sprite.properties
				})
			});

			lodash.forEach(retinaImages, function (image) {
				lodash.merge(image, {
					coordinatesRetina: coordinates,
					spritePathRetina: sprite.path,
					propertiesRetina: sprite.properties
				})
			});

		});
	});
}


/**
 * 替换相关background属性为sprite图
 *
 * @param  {Array}  images
 * @param  {Array}  sprites
 * @param  {Object} css
 * @param  {Object} opts
 */
function updateSpriteRef(images, sprites, css, opts) {
	var styleFilePath = css.source.input.file;
	var resultCssPath = path.join(path.dirname(styleFilePath), opts.tempDir);

	// 根节点font-size
	var rootFontSize = opts.rootFontSize ? opts.rootFontSize : getRootFontSize(css);

	css.walkComments(function (comment) {

		// 检测注释是否是要被替换的部分
		if ( /@replace/gi.test(comment.toString()) ) {

			// 找出与注释匹配的图片
			var allImages = lodash.filter(images, function (img) {
				return img.url == comment.text;
			});

			lodash.forEach(allImages, function (image) {
				// 生成sprite图的相对地址
				if(opts.mobileModel) {
					if(image.has_1x && image.retina == false) {
						image.spriteRef = path.relative(resultCssPath, image.spritePath).split(path.sep).join('/');
					}
				} else {
					if(image.has_1x) {
						image.spriteRef = path.relative(resultCssPath, image.spritePath).split(path.sep).join('/');
					}
				}
				if(image.retina) {
					image.spriteRefRetina = path.relative(resultCssPath, image.spritePathRetina).split(path.sep).join('/');
				}

				image.rootFontSize = rootFontSize;
			});

			var image = allImages[0];

			var backgroundImage, backgroundPosition, backgroundSize;

			if(opts.mobileModel) {
				if(image.retina == true) {
					backgroundImage = postcss.decl({
						prop: 'background-image',
						value: getBackgroundImageUrl(image, true)
					});
					backgroundPosition = postcss.decl({
						prop: 'background-position',
						value: getBackgroundPosition(image, opts, true)
					});
				} else {
					backgroundImage = postcss.decl({
						prop: 'background-image',
						value: getBackgroundImageUrl(image)
					});
					backgroundPosition = postcss.decl({
						prop: 'background-position',
						value: getBackgroundPosition(image, opts)
					});
				}
				
			} else {
				backgroundImage = postcss.decl({
					prop: 'background-image',
					value: getBackgroundImageUrl(image)
				});

				backgroundPosition = postcss.decl({
					prop: 'background-position',
					value: getBackgroundPosition(image, opts)
				});
			}

			// 为ie6添加hack前缀
			if(image.typeGroup == 'ie6') {
				backgroundImage.raws.before = '\n_';
				backgroundPosition.raws.before = '\n_';
			}

			// 将token注释替换成相应的最终值
			comment.replaceWith(backgroundImage);

			var rule = backgroundImage.parent;

			// 写入 background-image 和 background-position
			rule.insertAfter(backgroundImage, backgroundPosition);

			// retina图写入 background-size
			if(opts.mobileModel) {
				if(image.retina) {
					if(image.has_1x == true) {
						backgroundSize = postcss.decl({
							prop: 'background-size',
							value: getBackgroundSize(image, opts, true)
						});
					} else {
						backgroundSize = postcss.decl({
							prop: 'background-size',
							value: getBackgroundSize(image, opts)
						});
					}
					backgroundPosition.parent.insertAfter(backgroundPosition, backgroundSize);
				}
			} else {
				if(image.retina && image.has_1x == false) {
					backgroundSize = postcss.decl({
						prop: 'background-size',
						value: getBackgroundSize(image, opts)
					});

					backgroundPosition.parent.insertAfter(backgroundPosition, backgroundSize);
				}
			}

		}
	});

}


/**
 * 生成@1x图对应retina图的media query样式
 *
 * @param  {Array}  images
 * @param  {Array}  sprites
 * @param  {Object} css
 * @param  {Object} opts
 */
function updateMediaQuery(images, sprites, css, opts) {
	var styleFilePath = css.source.input.file;

	// retina的media query参数
	var params = [
	  'only screen and (min--moz-device-pixel-ratio: 1.25)',
	  'only screen and (-webkit-min-device-pixel-ratio: 1.25)',
	  'only screen and (min-device-pixel-ratio: 1.25)',
	  'only screen and (min-resolution: 120dpi)',
	  'only screen and (min-resolution: 1.25dppx)'
	];

	var mediaRule = postcss.atRule({
		name : 'media',
		params : params.join(',')
	});

	// 只处理同时有@1x与@2x的图片
	var allImages = lodash.filter(images, function (img) {
		return img.retina == true && img.has_1x == true;
	});

	if(allImages.length > 0 && !opts.mobileModel) {

		lodash.forEach(allImages, function (img) {
			var retinaRule = postcss.rule({ selector: img.selector });

			if(img.sprite && !img.base64) {
				var backgroundImage = postcss.decl({
					prop: 'background-image',
					value: getBackgroundImageUrl(img, true)
				});

				var backgroundPosition = postcss.decl({
					prop: 'background-position',
					value: getBackgroundPosition(img, opts, true)
				});

				var backgroundSize = postcss.decl({
					prop: 'background-size',
					value: getBackgroundSize(img, opts, true)
				});

				retinaRule.append(backgroundImage, backgroundPosition, backgroundSize);

				mediaRule.append(retinaRule);
			} else {
				var size = imageSize(img.path);

				var backgroundImage = postcss.decl({
					prop: 'background-image',
					value: !img.base64 ? 'url('+path.relative(path.dirname(styleFilePath), img.pathRetina).split(path.sep).join('/')+')' : 'url('+img.base64RetinaData+')'
				});

				var backgroundSize = postcss.decl({
					prop: 'background-size',
					value: size.width.toString()+'px '+size.height.toString()+'px'
				});

				retinaRule.append(backgroundImage, backgroundSize);
				mediaRule.append(retinaRule);
			}

		});

		css.append(mediaRule);
	}

}


/**
 * 得到最终background-image的值
 *
 * @param  {Object} image
 * @param  {Boolean} atMedia
 * @return {String}
 */
function getBackgroundImageUrl(image, atMedia) {
	var template;
	if(image.has_1x) {
		if(!atMedia) {
			template = lodash.template('url(<%= image.spriteRef %>)');
		} else {
			template = lodash.template('url(<%= image.spriteRefRetina %>)');
		}
	} else {
		template = lodash.template('url(<%= image.spriteRefRetina %>)');
	}

	return template({ image: image });
}

/**
 * 得到最终background-position的值
 *
 * @param  {Object} image
 * @param  {Object} opts
 * @param  {Number} rootFontSize
 * @param  {Boolean} atMedia
 * @return {String}
 */
function getBackgroundPosition(image, opts, atMedia) {
	var x, y, template;
	if(image.has_1x) {
		if(!atMedia) {
			x = -1 * image.coordinates.x;
			y = -1 * image.coordinates.y;
		} else {
			x = -1 * image.coordinatesRetina.x / image.ratio;
			y = -1 * image.coordinatesRetina.y / image.ratio;
		}
	} else {
		x = -1 * image.coordinatesRetina.x / image.ratio;
		y = -1 * image.coordinatesRetina.y / image.ratio;
	}

	if(image.rem) {
		template = lodash.template("<%= (x ? x + 'rem' : x) %> <%= (y ? y + 'rem' : y) %>");
		return template({ x: x / image.rootFontSize, y: y / image.rootFontSize });
	} else {
		template = lodash.template("<%= (x ? x + 'px' : x) %> <%= (y ? y + 'px' : y) %>");
		return template({ x: x, y: y });
	}

}


/**
 * 得到最终background-size的值
 *
 * @param  {Object} image
 * @param  {Number} rootFontSize
 * @param  {Object} opts
 * @param  {Boolean} atMedia
 * @return {String}
 */
function getBackgroundSize(image, opts, atMedia) {
	var x, y, template;
	if(image.has_1x) {
		if(!atMedia) {
			x = image.properties.width;
			y = image.properties.height;
		} else {
			x = image.propertiesRetina.width / image.ratio;
			y = image.propertiesRetina.height / image.ratio;
		}
	} else {
		x = image.propertiesRetina.width / image.ratio;
		y = image.propertiesRetina.height / image.ratio;
	}

	if(image.rem) {
		template = lodash.template("<%= x %>rem <%= y %>rem");
		return template({ x: x / image.rootFontSize, y: y / image.rootFontSize });
	} else {
		template = lodash.template("<%= x %>px <%= y %>px");
		return template({ x: x, y: y });
	}
	
}


/**
 * 得到所有非sprite背景图的路径
 *
 * @param  {Object} images
 * @return {Array}
 */
function getNoSpriteImagesPath(images) {
	var allImages = lodash.filter(images, function (img) {
		return img.sprite == false && img.base64 == false;
	});
	var normalImages = lodash.pluck(allImages, 'path')
	var retinaImages = lodash.pluck(allImages, 'pathRetina');

	var arr = lodash.filter(normalImages.concat(retinaImages), function (img) {
		return img != null;
	});

	return lodash.uniq(arr);

}


/**
 * 处理base64图片
 *
 * @param  {Array} images
 * @param  {Object} opts
 * @param  {Function} cb
 * @return async
 */
function handleBase64(images, opts, cb) {
	var base64Info = [];

	async.forEachOf(images, function (image, key, callback) {
		if(image.base64) {
			if(image.path && image.pathRetina) {
				async.parallel([
					function(callback1) {
						imageToBase64(image.path, image.typeGroup, opts, function (err, base64Data) {
							if(err) {
								callback1(err);
							} else {
								base64Info.push({
									path : image.path,
									base64Data : base64Data
								})
								callback1();
							}
						})
					},
					function(callback1) {
						imageToBase64(image.pathRetina, image.typeGroup, opts, function (err, base64Data) {
							if(err) {
								callback1(err);
							} else {
								base64Info.push({
									pathRetina : image.pathRetina,
									base64RetinaData : base64Data
								})
								callback1();
							}
						})
					}
				], function (err, results) {
					if(err) {
						callback(err);
					} else {
						callback();
					}
				})
			} else {
				if(image.path) {
					imageToBase64(image.path, image.typeGroup, opts, function (err, base64Data) {
						if(err) {
							callback(err);
						} else {
							base64Info.push({
								path : image.path,
								base64Data : base64Data
							})
							callback();
						}
					})
				} else {
					if(image.pathRetina) {
						imageToBase64(image.pathRetina, image.typeGroup, opts, function (err, base64Data) {
							if(err) {
								callback(err);
							} else {
								base64Info.push({
									pathRetina : image.pathRetina,
									base64RetinaData : base64Data
								})
								callback();
							}
						})
					} else {
						callback();
					}
				}
			}
		} else {
			callback();
		}
		
	}, function (err) {
		if(err) {
			log('获取图片base64错误: '+err.message, 'error');
			return;
		}
		if(cb) {
			cb(base64Info);
		}
	})

}


/**
 * 图片路径转为base64
 *
 * @param  {String} imagePath
 * @param  {String} typeGroup
 * @param  {Object} opts
 * @param  {Function} cb
 * @return async
 */
function imageToBase64(imagePath, typeGroup, opts, cb) {
	fs.readFile(imagePath, function (err, buf) {
		if(err) {
			if(cb) {
				cb(err);
			}
		}
		if(opts.doImageMinfy && typeGroup != '32') {
			kakaImageMin([{savePath:imagePath, buffer:buf}], opts, function (err, doneImagesInfo) {
				var base64Data = 'data:' + mime.lookup(imagePath) + ';base64,' + doneImagesInfo[0].buffer.toString('base64');
				if(cb) {
					cb(null, base64Data);
				}
			})
		} else {
			var base64Data = 'data:' + mime.lookup(imagePath) + ';base64,' + buf.toString('base64');
			if(cb) {
				cb(null, base64Data);
			}
		}
	})
}


/**
 * 为每个图片添加base64相关数据
 *
 * @param  {Array} images
 * @param  {Array} base64Info
 */
function mapBase64(images, base64Info) {
	lodash.forEach(images, function (image) {
		lodash.forEach(base64Info, function (file) {
			if(image.path == file.path && image.pathRetina == file.pathRetina) {
				lodash.merge(image, {
					base64Data : file.base64Data,
					base64RetinaData : file.base64RetinaData
				})
			} else {
				if(image.pathRetina == file.pathRetina) {
					lodash.merge(image, {
						base64RetinaData : file.base64RetinaData
					})
				} else {
					if(image.path == file.path) {
						lodash.merge(image, {
							base64Data : file.base64Data
						})
					}
				}
			}
			
		})
	})
}


/**
 * 替换相关background属性为base64
 *
 * @param  {Array} images
 * @param  {Object} css
 * @param  {Object} opts
 */
function updateBase64Ref(images, css, opts) {

	var base64Images = lodash.filter(images, function (img) {
		return img.base64 == true;
	});

	if(base64Images.length>0) {
		css.walkDecls(/^background-image$/, function(decl) {
			var url = getImageUrl(decl.toString());

			lodash.forEach(base64Images, function (image) {
				if(image.url == url) {
					var base64Data;
					if(image.pathRetina && image.path) {
						base64Data = image.base64Data;
					} else {
						if(image.pathRetina) {
							base64Data = image.base64RetinaData;
						} else {
							if(image.path) {
								base64Data = image.base64Data;
							}
						}
					}
					var base64Decl = postcss.decl({
						prop: 'background-image',
						value: 'url('+base64Data+')'
					});
					decl.replaceWith(base64Decl);
				}
				
			})

		})
	}
}


/**
 * 替换非sprite图的background属性
 *
 * @param  {Array} images
 * @param  {Object} css
 * @param  {Object} opts
 */
function updateNormalRef(images, css, opts) {
	if(opts.mobileModel) {
		var styleFilePath = css.source.input.file;

		var normalRetinaImages = lodash.filter(images, function (img) {
			return img.retina == true && img.sprite == false && img.has_1x == true;
		});

		if(normalRetinaImages.length > 0) {
			css.walkDecls(/^background-image$/, function(decl) {
				var rule = decl.parent;
				var url = getImageUrl(decl.toString());

				lodash.forEach(normalRetinaImages, function (image) {
					if(image.url == url) {
						var size = imageSize(image.path);

						var backgroundImage = postcss.decl({
							prop: 'background-image',
							value: !image.base64 ? 'url('+path.relative(path.dirname(styleFilePath), image.pathRetina).split(path.sep).join('/')+')' : 'url('+image.base64RetinaData+')'
						});

						var backgroundSize = postcss.decl({
							prop: 'background-size',
							value: size.width.toString()+'px '+size.height.toString()+'px'
						});

						decl.replaceWith(backgroundImage);
						rule.append(backgroundSize);
					}
					
					
				})
			})
		}
	}

}


/**
 * 非sprite背景图新文件名
 *
 * @param  {Array} images
 * @param  {Object} css
 * @param  {Object} opts
 */
function setBgImageNewFileName(images, css, opts) {
	if(opts.noSpriteBgImgNewName && opts.syncResource) {
		var styleFilePath = css.source.input.file;
		// 时间戳
		var timestamp = opts.timestamp ? '-'+opts.timestamp : '-'+kakaTime(opts);

		// 所有非sprite背景图
		var noSpriteBgImages = lodash.filter(images, function (img) {
			return img.sprite == false;
		})

		if(noSpriteBgImages.length > 0) {
			css.walkDecls(/^background(-image)?$/, function(decl) {
				var rule = decl.parent;
				var url = getImageUrl(decl.toString());

				lodash.forEach(noSpriteBgImages, function (image) {
					if(image.url == url) {
						// 图片临时保存目录路径
						// var imgTempDirPath = path.join(path.dirname(styleFilePath), opts.tempDir, path.dirname(url));
						var imgTempDirPath = path.join( path.resolve( path.dirname(styleFilePath), path.dirname(url) ), opts.tempDir);
						// 创建临时目录
						if (!fs.existsSync(imgTempDirPath)) {
							mkdirp.sync(imgTempDirPath);
						}

						// 新图片名
						var imgBaseName = path.basename(url);
						var match = /(?:@(\d)x)?\.[a-z]{3,4}$/gi.exec(imgBaseName);
						var fixedExtname = match[0];
						var replaceName = imgBaseName.replace(fixedExtname, '');
						var newImgBaseName = replaceName + timestamp + fixedExtname;
						// 新图片临时路径
						var imgTempPath = path.join(imgTempDirPath, newImgBaseName);

						var imagePath;
						// 更新图片路径信息，用于压缩
						if(isUseRetinaImage(url)) {
							imagePath = image.pathRetina;
							image.pathRetina = imgTempPath;
						} else {
							imagePath = image.path;
							image.path = imgTempPath;
						}
						
						// 写入临时文件夹
						fs.writeFileSync(imgTempPath, fs.readFileSync(imagePath));

						// 更新css中的图片文件名
						decl.value = decl.value.replace(imgBaseName,newImgBaseName);

					}
				})
			})
		}
	}

}


/**
 * 检测有背景图的rule
 *
 * @param  {String}  rule
 * @return {Boolean}
 */
function hasImageInRule(rule) {
	return /background(?:-image)?[^;}]*\burl\b\([\s]*(['"]?[\s]*(?!['"]?http[s]?)[^;}\s]+[\s]*['"]?)[\s]*\)[^;}]*/gi.test(rule);
}


/**
 * 提取背景图的url
 *
 * @param  {String} rule
 * @return {String}
 */
function getImageUrl(rule) {
	var match = /background(?:-image)?[^;}]*\burl\b\([\s]*(['"]?[\s]*(?!['"]?http[s]?)[^;}\s]+[\s]*['"]?)[\s]*\)[^;}]*/gi.exec(rule);
	return match ? match[1].replace(/['"\s]/gi, '') : '';
}


/**
 * 检测是否符合sprite图规则(只支持PNG)
 *
 * @param  {String}  rule
 * @return {Boolean}
 */
function hasSliceImageInRule(rule) {
	return /background-image[\s]*:[\s]*url\([\s]*(['"]?[\s]*(?!['"]?http[s]?)[^;}\s]*\/?\bslice\b[^;}\s]*\/+[^;}\s]+\.png\b[^;}\s]*[\s]*['"]?)[\s]*\)/gi.test(rule);
}


/**
 * 提取slice图片url(只支持PNG)
 *
 * @param  {String} rule
 * @return {String}
 */
function getSliceImageUrl(rule) {
	var match = /background-image[\s]*:[\s]*url\([\s]*(['"]?[\s]*(?!['"]?http[s]?)[^;}\s]*\/?\bslice\b[^;}\s]*\/+[^;}\s]+\.png\b[^;}\s]*[\s]*['"]?)[\s]*\)/gi.exec(rule);
	return match ? match[1].replace(/['"\s]/gi, '') : '';
}


/**
 * 是否直接使用了retina图片
 *
 * @param  {String}  url
 * @return {Boolean}
 */
function isUseRetinaImage(url) {
	return /@(\d)x\.[a-z]{3,4}$/gi.test(url);
}


/**
 * 获取retina的ratio值
 *
 * @param  {String} url
 * @return {Number}
 */
function getRetinaRatio(url) {
	var matche = /@(\d)x\.[a-z]{3,4}$/gi.exec(url);
	var ratio   = lodash.parseInt(matche[1]);
	return ratio;
}


/**
 * 得到根节点的font-size值
 *
 * @param  {Object} css
 * @return {Number}
 */
function getRootFontSize(css) {
	var rootFontSize = 16;

	css.walkRules(function (rule) {
		if(rule.parent && rule.parent.type === 'atrule') { return; }
		if (/^(html|:root)$/.test(rule.selectors)) {
			rule.walkDecls(function (decl) {
				if (decl.prop === 'font-size') {
					rootFontSize = Number(decl.value.replace('px',''));
				}
			});
		}
	})

	return rootFontSize;
}


/**
 * 得到自定义图片设置属性
 *
 * @param  {String}  url
 * @return {String}
 */
/*function getCustomSet(url) {
	var matche = /(\?\S*)$/gi.exec(url);
	return matche ? matche[1] : '';
}*/

