var about = module.exports = {
  init: init,
  win: null
}

// var config = require('../../config')
var electron = require('electron')
var path = require('path');

function init () {
  if (about.win) {
    return about.win.show()
  }

  var win = about.win = new electron.BrowserWindow({
    backgroundColor: '#ECECEC',
    center: true,
    fullscreen: false,
    height: 170,
    // icon: getIconPath(),
    maximizable: false,
    minimizable: false,
    resizable: false,
    show: false,
    skipTaskbar: true,
    // title: 'About ' + config.APP_WINDOW_TITLE,
    title: '',
    useContentSize: true,
    width: 300
  })

  win.loadURL('file://' + path.join(__dirname, '../..', 'static', 'about.html'))
  

  // No menu on the About window
  win.setMenu(null)

  win.once('ready-to-show', function () {
    win.show()
  })

  win.once('closed', function () {
    about.win = null
  })
}

/*function getIconPath () {
  return process.platform === 'win32'
    ? config.APP_ICON + '.ico'
    : config.APP_ICON + '.png'
}*/
