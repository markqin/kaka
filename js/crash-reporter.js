module.exports = {
  init: init
}

function init () {
  var config = require('./config')
  var electron = require('electron')

  electron.crashReporter.start({
    companyName: config.APP_NAME,
    productName: config.APP_NAME,
    submitURL: config.CRASH_REPORT_URL
  })
}
