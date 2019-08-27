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
var UglifyES = require("uglify-es");
var autoprefixer = require('autoprefixer');


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
    syncResource : true,
    to1x : false,
    noMinJS : false,
    noMangleJS : false,
    cssForJsTimeTag : false,
    miniCSS: true,
    cssKeepBreaks :false
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
                try {
                    if(filesGroups.ignore.length>0) {
                        log('不支持以下格式的文件: ', 'warning')
                        filesGroups.ignore.forEach(function (file) {
                            log(file, 'log')
                        })
                        log('===== end =====', 'warning')
                    }
                    cb(err, filesGroups);
                } catch (error) {
                    cb(error, filesGroups);
                }
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
                            // 保存临时目录
                            if (opts.saveLocal) {
                                imagesAllInfo.forEach((item) => {
                                    if (!fs.existsSync(path.dirname(item.savePath))) {
                                        mkdirp.sync(path.dirname(item.savePath))
                                    }
                                    fs.writeFileSync(item.savePath, item.buffer)
                                })
                            }
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
            postcss(postcssList(opts))
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

                        var newCSS;
                        // 压缩优化CSS
                        // console.log(result.css)
                        if(opts.miniCSS) {
                            newCSS = new CleanCSS({compatibility:'ie7',keepBreaks:opts.cssKeepBreaks,rebase: false}).minify(result.css).styles;
                        } else {
                            newCSS = result.css;
                        }

                        // 所有背景图以及sprite图信息
                        var images = result.messages[0].images;

                        // CSS文件时间戳注释标记
                        var timestampTag = creatTimeTag(opts,opts.cssForJsTimeTag);

                        newCSS = newCSS+timestampTag;

                        // console.log(newCSS)

                        cssFilesInfo.push({
                            savePath : savePath,
                            buffer : new Buffer(newCSS)
                        })

                        log(path.basename(cssPath)+' 处理成功！', 'log')

                        cssImagesInfo.unshift.apply(cssImagesInfo, images);


                        // 如果需要保存文件到本地
                        if(opts.saveLocal) {
                            fs.writeFile(savePath, newCSS, function (err) {
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
            console.log(err)
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


// 自动添加前缀
function addPrefixer(opts) {
    var browsersConfig = ["last 2 version"];
    if(opts.mobileModel) {
        browsersConfig = ["iOS >= 8", "Android >= 4.0", "Chrome >= 37"];
    } else {
        browsersConfig = ["Chrome >= 30", "ie >= 7", "Safari >= 7", "ff >= 30"];
    }
    return autoprefixer({browsers:browsersConfig});
}



// 通过PostCSS处理的方法数组
function postcssList(opts) {
    var arr = [kakaCSS(opts)];
    if(opts.useAutoprefixer) {
        arr.push(addPrefixer(opts));
    }
    return arr;
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
        // console.log(readeyMinImages)
        minCssImages(readeyMinImages, opts, function(err, minDoneImagesInfo) {
            if(err) {
                if(cb) {
                    cb(err);
                }
            } else {
                if(cb) {
                    log('css中的图片压缩成功!', 'log');
                    // console.log(minDoneImagesInfo)
                    // 保存临时目录
                    if (opts.saveLocal) {
                        minDoneImagesInfo.forEach((item) => {
                            if (!fs.existsSync(path.dirname(item.savePath))) {
                                mkdirp.sync(path.dirname(item.savePath))
                            }
                            fs.writeFileSync(item.savePath, item.buffer)
                        })
                    }

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
            cb();
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
                        var minResult
                        // 默认ES5
                        if (!opts.isES6) {
                            minResult = UglifyJS.minify(jsContent, {
                                // 是否混淆
                                mangle: opts.noMangleJS ? false : true
                            });
                        } else {
                            minResult = UglifyES.minify(jsContent, {
                                // 是否混淆
                                mangle: opts.noMangleJS ? false : true
                            })
                        }

                        if (minResult.error) {
                            throw minResult.error
                        } else {
                            jsContent = minResult.code+creatTimeTag(opts);
                            jsBuf = new Buffer(jsContent);
                        }
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
            log('JS文件处理出错!', 'error');
            if (err.message) {
                log('message: '+err.message, 'error')
            }
            if (err.col && err.line) {
                log('line: '+err.line, 'error')
                log('col: '+err.col, 'error')
            }
            if (err.filename) {
                log('filename: '+err.filename, 'error')
            }
            cb();
        } else {
            if(cb) {
                cb(jsFilesInfo);
            }
        }
    })

}


// 文件时间戳注释标记
function creatTimeTag(opts,isCssTimeTag) {
    var timeTag;
    var userNameTag;
    
    if(opts.userName) {
        // 用户名缩写
        var userName = opts.userName;
        var newUserName = userName.slice(0,2)+userName.slice(-1);
        userNameTag = ','+newUserName;
    }

    var cssTimeTag = '\n#KAKA{content:"'+opts.timestamp+userNameTag+'"}';
    var commonTimeTag = '\n/* kaka:'+kakaTime(opts)+userNameTag+' */';

    timeTag = isCssTimeTag ? cssTimeTag+commonTimeTag : commonTimeTag;

    return timeTag;

}


