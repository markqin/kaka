const electron = require('electron');
// Module to control application life.
const {app,Menu} = electron;
// Module to create native browser window.
const {BrowserWindow} = electron;

var path = require('path');
var windows = require('./main/windows')
var shell = electron.shell;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

// macOS/Linux file descriptor limit
if(process.platform == 'darwin') {
  process.setFdLimit(10480);
}

//Squirrel
var path = require('path');
var cp = require('child_process');

  function executeSquirrelCommand(args, done) {
      var updateDotExe = path.resolve(path.dirname(process.execPath), 
         '..', 'update.exe');
      var child = cp.spawn(updateDotExe, args, { detached: true });
      child.on('close', function(code) {
         done();
      });
  };

  function install(done) {
      var target = path.basename(process.execPath);
      executeSquirrelCommand(["--createShortcut", target], done);
   };

   function uninstall(done) {
      var target = path.basename(process.execPath);
      executeSquirrelCommand(["--removeShortcut", target], done);
   };

var handleSquirrelEvent = function() {
   if (process.platform != 'win32') {
      return false;
   }
   var squirrelEvent = process.argv[1];
   switch (squirrelEvent) {
      case '--squirrel-install':
         install(app.quit);
         return true;
      case '--squirrel-updated':
         install(app.quit);
         return true;
      case '--squirrel-obsolete':
         app.quit();
         return true;
      case '--squirrel-uninstall':
         uninstall(app.quit);
         return true;
   }

   return false;
};

if (handleSquirrelEvent()) {
   return;
}
//end Squirrel



function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    title: "KAKA",
    width: 800,
    height: 750,
    minWidth: 650,
    minHeight: 750,
    autoHideMenuBar: true,
    show: false,
    resizable: true
  });

  // and load the index.html of the app.
  win.loadURL(`file://${__dirname}/index.html`);

  // Open the DevTools.
  // win.webContents.openDevTools();

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  // Create the Application's main menu
  var template = [
    {
      label: "KAKA",
      submenu: [
          { 
            label: "关于KAKA", 
            click: function () { return windows.about.init(); }
          },
          { type: "separator" },
          { label: "退出KAKA", accelerator: "Command+Q", click: function() { app.quit(); }}
      ]
    },
    {
      label: "修改",
      submenu: [
          { label: "撤销", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
          { label: "重做", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
          { type: "separator" },
          { label: "剪切", accelerator: "CmdOrCtrl+X", selector: "cut:" },
          { label: "复制", accelerator: "CmdOrCtrl+C", selector: "copy:" },
          { label: "粘贴", accelerator: "CmdOrCtrl+V", selector: "paste:" },
          { label: "全选", accelerator: "CmdOrCtrl+A", selector: "selectAll:" }
      ]
    },
    {
      label: "视图",
      submenu: [
        {
          label: '窗口置顶',
          type: 'checkbox',
          click: function (menuItem, browserWindow, event) {
            if(!win.isAlwaysOnTop()) {
              browserWindow.setAlwaysOnTop(true);
              menuItem.checked = true;
            } else {
              browserWindow.setAlwaysOnTop(false);
              menuItem.checked = false;
            }
          }
        },
        {
          type: 'separator'
        },
        {
          label: '开发者',
          submenu: [
            {
              label: "刷新", 
              accelerator: process.platform === 'darwin' ? 'Alt+Command+R' : 'Ctrl+Shift+R',
              click (item, focusedWindow) {
                if (focusedWindow) focusedWindow.reload();
              } 
            },
            {
              label: '开发者工具',
              accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
              click (item, focusedWindow) {
                if(win.webContents.isDevToolsOpened()) {
                  win.webContents.closeDevTools();
                } else {
                  win.webContents.openDevTools({ detach: true });
                }
              }
            }
          ]
        }
      ]
    },
    {
      label: "帮助",
      submenu: [
        {
          label: '官网',
          click: function () {
            shell.openExternal('https://kaka.tonytony.club/')
          }
        },
        {
          label: 'GitHub仓库',
          click: function () {
            shell.openExternal('https://github.com/markqin/kaka')
          }
        },
        {
          type: 'separator'
        },
        {
          label: '问题反馈',
          click: function () {
            shell.openExternal('https://github.com/markqin/kaka/issues')
          }
        }
      ]
    }
  ]

  win.on('ready-to-show', function() {
    win.show();
    win.focus();
  });


  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow();
  }
});



/*function onToggleAlwaysOnTop (flag) {
  getMenuItem('Float on Top').checked = flag
}

function toggleAlwaysOnTop (flag) {
  if (!main.win) { return }
  if (flag == null) {
    flag = !main.win.isAlwaysOnTop()
  }
  log(("toggleAlwaysOnTop " + flag))
  main.win.setAlwaysOnTop(flag)
  menu.onToggleAlwaysOnTop(flag)
}*/


