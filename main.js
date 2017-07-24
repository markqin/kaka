const electron = require('electron');
// Module to control application life.
const {app,Menu} = electron;
// Module to create native browser window.
const {BrowserWindow} = electron;

var path = require('path');
var windows = require('./main/windows')

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
    // title: "KAKA",
    width: 800,
    height: 750,
    minWidth: 650,
    minHeight: 750,
    // alwaysOnTop: true,
    autoHideMenuBar: true
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
              label: "About KAKA", 
              click: function () { return windows.about.init(); }
            },
            { type: "separator" },
            {
              label: '官网',
              click () { require('electron').shell.openExternal('https://tonytony.club/tool/kaka/') }
            },
            { label: "Quit", accelerator: "Command+Q", click: function() { app.quit(); }}
        ]
      },
      {
        label: "Dev",
        submenu: [
            { 
              label: "Reload", 
              accelerator: "CmdOrCtrl+R", 
              click (item, focusedWindow) {
                if (focusedWindow) focusedWindow.reload();
              } 
            },
            {
              label: 'Developer Tools',
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
      
    ];

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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.