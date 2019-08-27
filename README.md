# kaka
UI工程师伴侣-UI开发构建工具

### v0.3.2 更新：
* UPDATE: 图片压缩依赖与机制更新
* FIX: 若干小BUG修复

### v0.3.1 更新：
* UPDATE: autoprefixer升级至v9.4.4，解决mask-image等处理bug
* UPDATE: lodash升级至v4.17.11，解决安全漏洞警报
* UPDATE: clean-css升级至v4.2.1

### v0.3.0 更新：
* 修复背景图片新文件名时的路径错误BUG


### v0.2.9 更新：
* 修复clean-css导致图片文件相对路径错误的BUG
* 修复文件路径不存在时不能正确回调的BUG


### v0.2.8 更新：
* 修复js文件报错后不可操作的BUG
* npm包升级: uglify-js升级至3.3.21
* 增加ES6+语法的压缩支持(uglify-es v3.3.9)


### v0.2.7 更新：
* 修复css压缩导致部分非标准属性消失的BUG（升级clean-css v4.1.9）
* 开启autoprefixer（v7.1.2，暂时不支持自定义）
* 暂时隐藏不完善的操作记录功能


### v0.2.6 更新：
* 增加操作记录功能
* 增加autoprefixer
* 增加窗口置顶功能
* 升级npm模块 PostCSS 6.0.8


### v0.2.5 更新：
* 增加CSS文件中非Sprite背景图用新文件名的功能（默认开启），解决缓存问题
* 修复时间戳的小BUG
* 修改部分默认初始配置项：
  * 默认处理非Sprite图片
  * 默认Sprite图用新文件名
  * 默认不压缩和混淆js文件
* 修改APP的系统级menu


### v0.2.4 更新：
* 修复mac下不能复制粘贴的BUG


### v0.2.3 更新：
* HTTP上传增加密钥验证
* 修改rem sprite的bug
* 修改时间戳逻辑
* 取消上传文件的类型检测



### v0.2.2 更新：
* 增加HTTP上传模式，暂时取消FTP模式
* 修复部分BUG


### v0.2.1 更新：
* 修改部分@import文件不能正确引入宿主文件的BUG
* 修复Windows下安装出现双图标的问题


### v0.2.0 更新：

* 基于electron v1.1.1版本
* 增加加对js文件的压缩混淆支持
* 增加ftp上传文件类型白名单机制
* 增加css文件中为js提供的时间戳标记
* 增加配置文件更新机制
* 增加版本更新功能
* 修改@import文件与其宿主文件sprite图的生成逻辑
* 修改部分BUG
* 修改部分UI