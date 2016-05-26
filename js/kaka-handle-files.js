'use strict';

var fs = require('fs');
var path = require('path');
var os = require('os');
var async = require('async');
var lodash = require('lodash');
var postcss = require('postcss');
var CleanCSS = require('clean-css');
var kakaFilePre = require('./kaka-files-preprocess');
var kakaCSS = require('./kaka-handle-css');
var kakaImgMin = require('./kaka-image-minify');
var kakaImgScale = require('./kaka-image-scale');
var kakaTime = require('./kaka-timestamp');
var log = require('./log');
var mkdirp = require('mkdirp');
var UglifyJS = require("uglify-js");


/**
 * 默认配置
 *
 * @type {Object}
 */
var defaults = {
    doImageMinfy : true,
    tempDir : '',
    timestamp : '',
    useTimestampCss : false,
    saveLocal : true,
    syncResource : false,
    to1x : false,
    noMinJS : false,
    noMangleJS : false,
    jsTimeTag : false
};


/**
 * 主函数
 *
 * @param  {Array} files
 * @param  {Object} opts
 * @param  {Function} callback
 * @api public
 */
module.exports = function(files, opts, callback) {
    var options = lodash.merge({}, defaults, opts || {});

    async.waterfall([
        // 文件预处理
        function (cb) {
            kakaFilePre(files, options, function (err, filesGroups) {
                /*css : {importFiles: [],normal: []},
                img : {original: [],worked: []},
                html : [],
                js : [],
                whiteList: [],
                ignore : []*/
                if(filesGroups.ignore.length>0) {
                    log('不支持以下格式的文件: ', 'warning')
                    filesGroups.ignore.forEach(function (file) {
                        log(file, 'log')
                    })
                    log('===== end =====', 'warning')
                }
                cb(err, filesGroups);
            });
        },
        // 各种文件处理
        function (filesGroups, cb) {
            async.parallel([
                function(callback1) {
                    // CSS文件处理
                    if(filesGroups.css.normal.length > 0) {
                        handleCss(filesGroups.css.normal, options, function (err, cssAllInfo) {
                            callback1(err, cssAllInfo)
                        })
                    } else {
                        callback1(null, null)
                    }
                },
                function(callback1) {
                    // 图片处理
                    if(filesGroups.img.original.length > 0 || filesGroups.img.worked.length > 0) {
                        handleImages(filesGroups.img, options, function (err, imagesAllInfo) {
                            callback1(err, imagesAllInfo)
                        })
                    } else {
                        callback1(null, null)
                    }
                },
                function(callback1) {
                    // HTML处理
                    if(filesGroups.html.length > 0) {
                        handleHTML(filesGroups.html, options, function (htmlAllInfo) {
                            callback1(null, htmlAllInfo)
                        })
                    } else {
                        callback1(null, null)
                    }
                },
                function(callback1) {
                    // JS处理
                    if(filesGroups.js.length > 0) {
                        handleJS(filesGroups.js, options, function (jsAllInfo) {
                            callback1(null, jsAllInfo)
                        })
                    } else {
                        callback1(null, null)
                    }
                },
                function(callback1) {
                    // 白名单文件处理
                    if(filesGroups.whiteList.length > 0) {
                        callback1(null, filesGroups.whiteList)
                    } else {
                        callback1(null, null)
                    }
                }
            ], function (err, results) {
                if(err) {
                    cb(err);
                } else {
                    var doneData = lodash.filter(lodash.flatten(results), function (item) {
                        return item != null;
                    })
                    cb(null, lodash.uniq(doneData));
                }
            })
            
        }
        
    ], function (err, results) {
        if(err) {
            // log('文件处理阶段出错: '+err.message, 'error');
            if(err) {
                callback(err);
            }
        } else {
            log('文件全部处理成功！', 'ok')

            if(callback) {
                callback(null, results);
            }
        }
    });
}


/**
 * CSS文件处理
 *
 * @param  {Array} files
 * @param  {Object} opts
 * @param  {Function} cb
 * @return async
 */
function handleCss(files, opts, cb) {
    var cssFilesInfo = [];
    var cssImagesInfo = [];

    async.forEachOf(files, function (cssPath, key, callback) {
        var cssFileName = path.basename(cssPath);

        log(cssFileName+' 正在处理...', 'log')

        fs.readFile(cssPath, function (err, css){
            if(err) {
                callback(err);
            }

            // CSS文件各种处理
            postcss([ kakaCSS(opts) ])
                .process(css, {
                    from: cssPath
                })
                .then(function (result) {

                    try {
                        // 带时间戳的新文件名
                        if(opts.useTimestampCss) {
                            var basename = path.basename(cssPath,'.css');
                            cssFileName = basename+'-'+opts.timestamp+'.css';
                        }

                        // 文件保存路径
                        var savePath = path.join(path.dirname(cssPath), opts.tempDir, cssFileName).split(path.sep).join('/');

                        // 压缩优化CSS
                        var miniCSS = new CleanCSS({compatibility:'ie7',keepBreaks:false}).minify(result.css).styles;

                        // 所有背景图以及sprite图信息
                        var images = result.messages[0].images;

                        // CSS文件时间戳注释标记
                        var timestampTag = creatTimeTag(opts);
                        if(opts.jsTimeTag) {
                            timestampTag = opts.userName ? '\n#KAKA{content:"'+kakaTime()+','+opts.userName+'"}' : '\n#KAKA{content:"'+kakaTime()+'"}';
                        }

                        miniCSS = miniCSS+timestampTag;

                        cssFilesInfo.push({
                            savePath : savePath,
                            buffer : new Buffer(miniCSS)
                        })

                        log(path.basename(cssPath)+' 处理成功！', 'log')

                        cssImagesInfo.unshift.apply(cssImagesInfo, images);


                        // 如果需要保存文件到本地
                        if(opts.saveLocal) {
                            fs.writeFile(savePath, miniCSS, function (err) {
                                if(err) {
                                    callback(err);
                                } else {
                                    log(path.basename(savePath)+' 处理后文件保存到临时目录成功！', 'log')
                                    callback();
                                }
                            })
                        } else {
                            callback();
                        }

                    } catch (err) {
                        callback(err);
                    }
                    
                })
                .catch(function (err) {
                    callback(err);
                });

        })
        
    }, function (err) {
        if(err) {
            if(err.name == 'CssSyntaxError') {
                log('CSS语法错误: '+err.message+' ', 'error');
            } else {
                log('CSS文件处理出错: '+err.message, 'error');
            }
            if(cb) {
                cb(err)
            }
        } else {
            // 处理css中的图片
            handleCssImages(cssImagesInfo, opts, function(err, doneImagesInfo) {
                if(err) {
                    if(cb) {
                        cb(err);
                    }
                } else {
                    if(cb) {
                        // 返回css文件信息和相关图片信息
                        doneImagesInfo.push.apply(doneImagesInfo, cssFilesInfo);
                        cb(null, doneImagesInfo);
                    }
                    
                }
            })
        }
        
    })
}


/**
 * CSS文件中的图片处理
 *
 * @param  {Array} images
 * @param  {Object} opts
 * @param  {Function} cb
 * @return async
 */
function handleCssImages(images, opts, cb) {
    // 图片分组
    var originalNormalImages = [];
    var workedNormalImages = [];
    var originalSpriteImages = [];
    var workedSpriteImages = [];

    images.forEach(function (img) {
        if(typeof img === 'string') {
            if(/\.\b32\b/.test(img)) {
                workedNormalImages.push(img);
            } else {
                originalNormalImages.push(img);
            }
        } else if (typeof img === 'object') {
            if(/\.\b32\b/.test(img.savePath)) {
                workedSpriteImages.push(img);
            } else {
                originalSpriteImages.push(img);
            }
        }
    })

    // 准备压缩处理的图片
    var readeyMinImages;
    var othersImages;

    // 如果不同步资源
    if(!opts.syncResource) {
        readeyMinImages = originalSpriteImages;
        othersImages = workedSpriteImages;
    } else {
        readeyMinImages = originalSpriteImages.concat(originalNormalImages);
        othersImages = workedNormalImages.concat(workedSpriteImages);
    }

    // 压缩CSS中的图片
    if(opts.doImageMinfy && readeyMinImages.length > 0) {
        log('正在压缩css中的图片...', 'log');
        minCssImages(readeyMinImages, opts, function(err, minDoneImagesInfo) {
            if(err) {
                if(cb) {
                    cb(err);
                }
            } else {
                if(cb) {
                    log('css中的图片压缩成功!', 'log');
                    var doneImagesInfo = minDoneImagesInfo.concat(othersImages);
                    cb(null, doneImagesInfo);
                }
            }
        })
    } else {
        var doneImagesInfo = readeyMinImages.concat(othersImages);
        cb(null, doneImagesInfo);
    }

}



/**
 * 压缩CSS文件中的图片
 *
 * @param  {Array} images
 * @param  {Object} opts
 * @param  {Function} cb
 * @return async
 */
function minCssImages(images, opts, cb) {
    // 图片压缩处理
    if(os.platform() != 'darwin') {
        // 图片压缩
        kakaImgMin(images, opts, function (err, minDoneImagesInfo) {
            if(err) {
                if(cb) {
                    cb(err)
                }
            } else {
                if(cb) {
                    cb(null, minDoneImagesInfo);
                }
            }
        })
    } else {
        // 如果OSX下文件过多
        var filesSize = 0;
        images.forEach(function (item) {
            if(typeof item === 'string') {
                filesSize += fs.readFileSync(item).length
            } else if (typeof item === 'object') {
                filesSize += item.buffer.length
            }
        })

        // if(images.length > 100) {
        if(Math.floor(filesSize/1000)> 1024) {
            log('OSX系统限制，压缩图片过多！', 'error');
            if(cb) {
                cb(images);
            }
        } else {
            // 图片压缩
            kakaImgMin(images, opts, function (err, minDoneImagesInfo) {
                if(err) {
                    if(cb) {
                        cb(err);
                    }
                } else {
                    if(cb) {
                        cb(null, minDoneImagesInfo);
                    }
                }

            })
        }
    }
}


/**
 * 非CSS中的图片处理
 *
 * @param  {Object} images
 * @param  {Object} opts
 * @param  {Function} cb
 * @return async
 */
function handleImages(images, opts, cb) {
    var allImages = images.original.concat(images.worked);

    // retina图转@1x图
    if(opts.to1x) {
        if(!opts.doImageMinfy) {
            kakaImgScale(allImages, function(results) {
                results.unshift.apply(results, allImages);
                if(cb) {
                    cb(null, results)
                }
            })
        } else {
            async.parallel([
                function(callback) {
                    if(images.original.length > 0) {
                        kakaImgScale(images.original, function(results) {
                            results.unshift.apply(results, images.original)
                            kakaImgMin(results, opts, function (err, doneImagesInfo) {
                                if(err) {
                                    callback(err);
                                } else {
                                    doneImagesInfo.unshift.apply(doneImagesInfo, images.worked);
                                    callback(null, doneImagesInfo);
                                }
                            });
                        })
                    } else {
                        callback(null, []);
                    }
                },
                function(callback) {
                    if(images.worked.length > 0) {
                        kakaImgScale(images.worked, function(results) {
                            results.unshift.apply(results, images.worked)
                            callback(null, results)
                        })
                    } else {
                        callback(null, []);
                    }
                }
            ], function (err, allResults) {
                if(err) {
                    log('retina图转@1x图并压缩时出错: '+err.message, 'error')
                    if(cb) {
                        cb(err)
                    }
                } else {
                    if(cb) {
                        cb(null, lodash.flatten(allResults));
                    }
                }
            })     
        }
    } else {
        // 如果设定为执行压缩
        if(opts.doImageMinfy) {
            kakaImgMin(images.original, opts, function (err, doneImagesInfo) {
                if(err) {
                    if(cb) {
                        cb(err);
                    }
                } else {
                    doneImagesInfo.unshift.apply(doneImagesInfo, images.worked);
                    if(cb) {
                        cb(null, doneImagesInfo);
                    }
                }
            });
        } else {
            if(cb) {
                cb(null, allImages);
            }
        }
    }
    
}


/**
 * HTML处理
 *
 * @param  {Array} htmlFiles
 * @param  {Object} opts
 * @param  {Function} cb
 * @return async
 */
function handleHTML(htmlFiles, opts, cb) {
    var htmlFilesInfo = [];

    async.forEachOf(htmlFiles, function (htmlPath, key, callback) {
        fs.readFile(htmlPath, function (err, buf) {
            if(err) {
                callback(err);
            } else {
                htmlFilesInfo.push({
                    savePath : htmlPath,
                    buffer : buf
                });
                callback();
            }
        })
    }, function (err) {
        if(err) {
            log('HTML文件处理出错: '+err.message, 'error');
            return;
        } else {
            if(cb) {
                cb(htmlFilesInfo);
            }
        }
    })

}


/**
 * JS处理
 *
 * @param  {Array} jsFiles
 * @param  {Object} opts
 * @param  {Function} cb
 * @return async
 */
function handleJS(jsFiles, opts, cb) {
    var jsFilesInfo = [];

    async.forEachOf(jsFiles, function (jsPath, key, callback) {
        fs.readFile(jsPath, function (err, buf) {
            if(err) {
                callback(err);
            } else {
                try {
                    // 文件保存路径
                    var jsFileName = path.basename(jsPath);
                    var dirName = path.dirname(jsPath);
                    var saveDirPath = path.join(dirName, opts.tempDir);
                    var savePath = path.join(saveDirPath, jsFileName).split(path.sep).join('/');

                    var jsBuf = buf;
                    var jsContent = buf.toString()+creatTimeTag(opts);

                    // 压缩js 
                    if(!opts.noMinJS) {
                        var minJsResult = UglifyJS.minify(jsContent, {
                            fromString: true,
                            // 是否混淆
                            mangle: opts.noMangleJS ? false : true
                        });

                        jsContent = minJsResult.code+creatTimeTag(opts);
                        jsBuf = new Buffer(jsContent);
                    }
                    
                    // js文件信息
                    jsFilesInfo.push({
                        savePath : savePath,
                        buffer : jsBuf
                    });

                    // 如果需要保存文件到本地
                    if(opts.saveLocal) {
                        if(!fs.existsSync(saveDirPath)) {
                            mkdirp.sync(saveDirPath);
                        }
                        fs.writeFile(savePath, jsContent, function (err) {
                            if(err) {
                                callback(err);
                            } else {
                                log(path.basename(savePath)+' 处理后文件保存到临时目录成功！', 'log')
                                callback();
                            }
                            
                        })
                    } else {
                        callback();
                    }

                } catch (err) {
                    callback(err);
                }

            }
        })
    }, function (err) {
        if(err) {
            log('JS文件处理出错: '+err.message, 'error');
            return;
        } else {
            if(cb) {
                cb(jsFilesInfo);
            }
        }
    })

}


// 文件时间戳注释标记
function creatTimeTag(opts) {
    return opts.userName ? '\n/* kaka:'+kakaTime()+','+opts.userName+' */' : '\n/* kaka:'+kakaTime()+' */';
}


