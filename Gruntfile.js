var grunt = require('grunt');

//进行配置
grunt.config.init({
	pkg: grunt.file.readJSON("package.json"),
	'create-windows-installer':{
		x64:{
		version:'0.2.7',//版本号
		authors:'markqin,kiddhe,mollyywang',//作者
		projectUrl:'https://tonytony.club/tool/kaka/',//项目官网
		appDirectory:'/kakav0.2.7',//必填，真正要打包的项目目录
		outputDirectory: '/kaka-installer64',//必填，相当于Release，打包之后的存放目录
		releaseNotes:'KAKA--UI开发利器',//工具描述
		exe:'kaka.exe',//如果你没有改exe名字，此处应该是electron.exe
		description:'UI开发利器'//这个是app描述，安装后鼠标移到图标上面会显示的title
		}
	}
});

//加载任务
grunt.loadNpmTasks('grunt-electron-installer');

//设置为默认，如果有默认任务，可以不设置
grunt.registerTask('default', ['create-windows-installer']);