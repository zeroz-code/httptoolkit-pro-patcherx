const axios = require('axios').default
const electron = require('electron')
const hasInternet = () => axios.head('https://www.google.com').then(() => true).catch(() => false)
const port = process.env.PORT || 5067
const tempPath = path.join(os.tmpdir(), 'httptoolkit-patch')
console.log(`[Patcher] Selected temp path: ${tempPath}`)
process.env.APP_URL = `http://localhost:${port}`
const express = require('express')
const app = express()

app.disable('x-powered-by')

app.all('*', async (req, res) => {
  console.log(`[Patcher] Request to: ${req.url}`)
  if (new URL(req.url, process.env.APP_URL).pathname === '/ui-update-worker.js') return res.status(404).send('Not found')
  let filePath = path.join(tempPath, new URL(req.url, process.env.APP_URL).pathname === '/' ? 'index.html' : new URL(req.url, process.env.APP_URL).pathname)
  if (['/view', '/intercept', '/settings', '/mock'].includes(new URL(req.url, process.env.APP_URL).pathname)) {
    filePath += '.html'
  }
  if (!require('fs').existsSync(tempPath)) {
    console.log(`[Patcher] Temp path not found, creating: ${tempPath}`)
    require('fs').mkdirSync(tempPath)
  }
  if (!(await hasInternet())) {
    console.log(`[Patcher] No internet connection, trying to serve directly from temp path`)
    if (require('fs').existsSync(filePath)) {
      console.log(`[Patcher] Serving from temp path: ${filePath}`)
      res.sendFile(filePath)
    } else {
      console.log(`[Patcher] File not found in temp path: ${filePath}`)
      res.status(404).send('Not found')
    }
    return
  }
  try {
    const hasOld = require('fs').existsSync(filePath)
    if (hasOld) {
      const remoteDate = await axios.head(`https://app.httptoolkit.tech${req.url}`).then(res => new Date(res.headers['last-modified']))
      if (remoteDate < new Date(require('fs').statSync(filePath).mtime)) {
        console.log(`[Patcher] File not changed, serving from temp path`)
        res.sendFile(filePath)
        return
      }
    } else
    console.log(`[Patcher] File not found in temp path, downloading`)
    const remoteFile = await axios.get(`https://app.httptoolkit.tech${req.url}`, { responseType: 'arraybuffer' })
    const recursiveMkdir = dir => {
      if (!require('fs').existsSync(dir)) {
        recursiveMkdir(path.dirname(dir))
        require('fs').mkdirSync(dir)
      }
    }
    recursiveMkdir(path.dirname(filePath))
    let data = remoteFile.data
    if (new URL(req.url, process.env.APP_URL).pathname === '/main.js') {
      console.log(`[Patcher] Patching main.js`)
      data = data.toString('utf-8')
      const accStoreName = data.match(/class ([0-9A-Za-z_]+){constructor\(e\){this\.goToSettings=e/)?.[1]
      const modName = data.match(/([0-9A-Za-z_]+).(getLatestUserData|getLastUserData)/)?.[1]
      if (!accStoreName) console.error(`[Patcher] [ERR] Account store name not found in main.js`)
      else if (!modName) console.error(`[Patcher] [ERR] Module name not found in main.js`)
      else {
        let patched = data
          .replace(`class ${accStoreName}{`, `["getLatestUserData","getLastUserData"].forEach(p=>Object.defineProperty(${modName},p,{value:()=>user}));class ${accStoreName}{`)
        if (patched === data) console.error(`[Patcher] [ERR] Patch failed`)
        else {
          patched = `const user=${JSON.stringify({
            email,
            subscription: {
              status: 'active',
              expiry: new Date('9999-12-31').toISOString(),
              plan: 'pro-annual',
            }
          })};user.subscription.expiry=new Date(user.subscription.expiry);` + patched
          data = patched
          console.log(`[Patcher] main.js patched`)
        }
      }
    }
    require('fs').writeFileSync(filePath, data)
    console.log(`[Patcher] File downloaded and saved: ${filePath}`)
    for (const [key, value] of Object.entries(remoteFile.headers)) res.setHeader(key, value)
    res.sendFile(filePath)
  } catch (e) {
    console.error(`[Patcher] Error while fetching file: ${filePath}`, e)
    res.status(500).send('Internal server error')
  }
})

app.listen(port, () => console.log(`[Patcher] Server listening on port ${port}`))

electron.app.on('ready', () => {
  //? Patching CORS headers to allow requests from localhost
  electron.session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    //* Blocking unwanted requests to prevent tracking
    const blockedHosts = ['events.httptoolkit.tech']
    if (blockedHosts.includes(new URL(details.url).hostname) || details.url.includes('sentry')) return callback({ cancel: true })
    details.requestHeaders.Origin = 'https://app.httptoolkit.tech'
    callback({ requestHeaders: details.requestHeaders })
  })
  electron.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    details.responseHeaders['Access-Control-Allow-Origin'] = [`http://localhost:${port}`]
    delete details.responseHeaders['access-control-allow-origin']
    callback({ responseHeaders: details.responseHeaders })
  })
})