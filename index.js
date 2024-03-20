// @ts-check
import { execSync } from 'child_process'
import asar from '@electron/asar'
import prompts from 'prompts'
import path from 'path'
import yargs from 'yargs'
import chalk from 'chalk'
import fs from 'fs'
import os from 'os'

const argv = await yargs(process.argv.slice(2))
  .usage('Usage: node . <command> [options]')
  .command('patch', 'Patch HTTP Toolkit using the specified script')
  .command('restore', 'Restore HTTP Toolkit files to their original state')
  .command('start', 'Start HTTP Toolkit')
  .demandCommand(1, 'You need at least one command before moving on')
  .alias('h', 'help')
  .parse()

const appPath = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'httptoolkit')
const serverPath = (() => {
  let svPath = path.join(process.env.LOCALAPPDATA || '', 'httptoolkit-server', 'client')
  if (fs.existsSync(svPath)) {
    const versions = fs.readdirSync(svPath)
    return path.join(svPath, versions[0])
  }
  return path.join(appPath, 'resources', 'httptoolkit-server')
})()

if (!fs.existsSync(path.join(appPath, 'resources', 'app.asar'))) {
  console.error(chalk.redBright`[-] HTTP Toolkit not found`)
  process.exit(1)
}

if (!fs.existsSync(path.join(serverPath, 'bundle', 'index.js'))) {
  console.error(chalk.redBright`[-] HTTP Toolkit Server not found`)
  process.exit(1)
}

console.log(chalk.blueBright`[+] HTTP Toolkit found at {bold ${appPath}}`)
console.log(chalk.blueBright`[+] HTTP Toolkit Server found at {bold ${serverPath}}`)

const patchServer = () => {
  const filePath = path.join(serverPath, 'bundle', 'index.js')
  const data = fs.readFileSync(filePath, 'utf-8')
  
  if (data.includes('ALLOWED_ORIGINS=false')) {
    console.log(chalk.greenBright`[+] Server already patched`)
    return
  }

  console.log(chalk.blueBright`[+] Patching server...`)
  const patchedData = data.replace(/ALLOWED_ORIGINS=\w\.IS_PROD_BUILD/g, 'ALLOWED_ORIGINS=false')

  if (data === patchedData) {
    console.error(chalk.redBright`[-] Patch failed`)
    process.exit(1)
  }

  fs.writeFileSync(`${filePath}.bak`, data, 'utf-8')
  fs.writeFileSync(filePath, patchedData, 'utf-8')

  console.log(chalk.greenBright`[+] Server patched`)
}

const patchApp = async () => {
  const filePath = path.join(appPath, 'resources', 'app.asar')
  const tempPath = path.join(appPath, 'resources', 'app')
  
  if (fs.readFileSync(filePath).includes('Injected by HTTP Toolkit Injector')) {
    console.log(chalk.greenBright`[+] App already patched`)
    return
  }

  console.log(chalk.blueBright`[+] Patching app...`)

  if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { recursive: true, force: true })
  asar.extractAll(filePath, tempPath)

  const indexPath = path.join(tempPath, 'build', 'index.js')
  const data = fs.readFileSync(indexPath, 'utf-8')
  const { email } = await prompts({
    type: 'text',
    name: 'email',
    message: 'Enter a email for the pro plan',
    validate: value => value.includes('@') || 'Invalid email'
  })
  const patch = fs.readFileSync('patch.js', 'utf-8')
  const patchedData = data
    .replace('const APP_URL =', `// ------- Injected by HTTP Toolkit Injector -------\nconst email = \`${email.replaceAll('`', '\\`')}\`\n${patch}\n// ------- End injected content -------\nconst APP_URL =`)

  if (data === patchedData || !patchedData) {
    console.error(chalk.redBright`[-] Patch failed`)
    process.exit(1)
  }

  fs.writeFileSync(indexPath, patchedData, 'utf-8')
  console.log(chalk.blueBright`[+] Installing dependencies...`)
  execSync('npm install express axios', { cwd: tempPath, stdio: 'inherit' })
  fs.rmSync(path.join(tempPath, 'package-lock.json'), { force: true })
  fs.copyFileSync(filePath, `${filePath}.bak`)
  console.log(chalk.blueBright`[+] Building app...`)
  await asar.createPackage(tempPath, filePath)
  console.log(chalk.greenBright`[+] App patched`)
}

switch (argv._[0]) {
  case 'patch':
    await patchApp()
    patchServer()
    break
  case 'restore':
    try {
      console.log(chalk.blueBright`[+] Restoring server...`)
    if (!fs.existsSync(path.join(serverPath, 'bundle', 'index.js.bak')))
      console.error(chalk.redBright`[-] Server not patched or restore file not found`)
    else {
      fs.copyFileSync(path.join(serverPath, 'bundle', 'index.js.bak'), path.join(serverPath, 'bundle', 'index.js'))
      console.log(chalk.greenBright`[+] Server restored`)
    }
    console.log(chalk.blueBright`[+] Restoring app...`)
    if (!fs.existsSync(path.join(appPath, 'resources', 'app.asar.bak')))
      console.error(chalk.redBright`[-] App not patched or restore file not found`)
    else {
      fs.copyFileSync(path.join(appPath, 'resources', 'app.asar.bak'), path.join(appPath, 'resources', 'app.asar'))
      console.log(chalk.greenBright`[+] App restored`)
    }
    fs.rmSync(path.join(os.tmpdir(), 'httptoolkit-injected'), { recursive: true, force: true })
    } catch (e) {
      console.error(chalk.redBright`[-] An error occurred`, e)
      process.exit(1)
    }
    break
  case 'start':
    console.log(chalk.blueBright`[+] Starting HTTP Toolkit...`)
    execSync(`start "" "${path.join(appPath, 'HTTP Toolkit.exe')}"`, { stdio: 'ignore' })
    break
  default:
    console.error(chalk.redBright`[-] Unknown command`)
    process.exit(1)
}

console.log(chalk.greenBright`[+] Done`)