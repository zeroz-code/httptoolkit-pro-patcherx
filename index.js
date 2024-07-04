// @ts-check
import { execSync } from 'child_process'
import asar from '@electron/asar'
import prompts from 'prompts'
import yargs from 'yargs'
import chalk from 'chalk'
import path from 'path'
import fs from 'fs'
import os from 'os'

const argv = await yargs(process.argv.slice(2))
  .usage(`Usage: ${process.argv0} . <command> [options]`)
  .command('patch', 'Patch HTTP Toolkit using the specified script')
  .command('restore', 'Restore HTTP Toolkit files to their original state')
  .command('start', 'Start HTTP Toolkit')
  .demandCommand(1, 'You need at least one command before moving on')
  .alias('h', 'help')
  .parse()

const isWin = process.platform === 'win32'
const isMac = process.platform === 'darwin'

const appPath =
  isWin ? path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'httptoolkit', 'resources')
  : isMac ? '/Applications/HTTP Toolkit.app/Contents/Resources'
  : fs.existsSync('/opt/HTTP Toolkit/resources') ? '/opt/HTTP Toolkit/resources'
  : '/opt/httptoolkit/resources'

const isSudo = !isWin && (process.getuid || (() => process.env.SUDO_UID ? 0 : null))() === 0

if (!fs.existsSync(path.join(appPath, 'app.asar'))) {
  console.error(chalk.redBright`[-] HTTP Toolkit not found`)
  process.exit(1)
}

console.log(chalk.blueBright`[+] HTTP Toolkit found at {bold ${path.dirname(appPath)}}`)

const cleanUp = () => {
  console.log(chalk.redBright`[-] Operation cancelled, cleaning up...`)
  try {
    fs.rmSync(path.join(os.tmpdir(), 'httptoolkit-patch'), { recursive: true, force: true })
    fs.rmSync(path.join(appPath, 'app'), { recursive: true, force: true })
  } catch (e) {
    console.error(chalk.redBright`[-] An error occurred while cleaning up`, e)
  }
  process.exit(1)
}

const patchApp = async () => {
  const filePath = path.join(appPath, 'app.asar')
  const tempPath = path.join(appPath, 'app')

  if (fs.readFileSync(filePath).includes('Injected by HTTP Toolkit Patcher')) {
    console.log(chalk.greenBright`[+] App already patched`)
    return
  }

  console.log(chalk.blueBright`[+] Started patching app...`)

  console.log(chalk.yellowBright`[+] Extracting app...`)

  ;['SIGINT', 'SIGTERM'].forEach(signal => process.on(signal, cleanUp))

  try {
    if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { recursive: true, force: true })
    asar.extractAll(filePath, tempPath)
  } catch (e) {
    if (!isSudo && e.errno === -13) { //? Permission denied
      console.error(chalk.redBright`[-] Permission denied${!isWin ? ', try running with sudo' : ', try running node as administrator'}`)
      process.exit(1)
    }
    console.error(chalk.redBright`[-] An error occurred while extracting app`, e)
    process.exit(1)
  }

  const indexPath = path.join(tempPath, 'build', 'index.js')
  if (!fs.existsSync(indexPath)) {
    console.error(chalk.redBright`[-] Index file not found`)
    process.exit(1)
  }
  const data = fs.readFileSync(indexPath, 'utf-8')
  ;['SIGINT', 'SIGTERM'].forEach(signal => process.off(signal, cleanUp))
  const { email } = await prompts({
    type: 'text',
    name: 'email',
    message: 'Enter a email for the pro plan',
    validate: value => value.includes('@') || 'Invalid email'
  })
  if (!email || typeof email !== 'string') {
    console.error(chalk.redBright`[-] Email not provided`)
    process.exit(1)
  }
  ;['SIGINT', 'SIGTERM'].forEach(signal => process.on(signal, cleanUp))
  const patch = fs.readFileSync('patch.js', 'utf-8')
  const patchedData = data
    .replace('const APP_URL =', `// ------- Injected by HTTP Toolkit Patcher -------\nconst email = \`${email.replace(/`/g, '\\`')}\`\n${patch}\n// ------- End patched content -------\nconst APP_URL =`)

  if (data === patchedData || !patchedData) {
    console.error(chalk.redBright`[-] Patch failed`)
    process.exit(1)
  }

  fs.writeFileSync(indexPath, patchedData, 'utf-8')
  console.log(chalk.greenBright`[+] Patched index.js`)
  console.log(chalk.yellowBright`[+] Installing dependencies...`)
  try {
    execSync('npm install express', { cwd: tempPath, stdio: 'inherit' })
  } catch (e) {
    console.error(chalk.redBright`[-] An error occurred while installing dependencies`, e)
    process.exit(1)
  }
  fs.rmSync(path.join(tempPath, 'package-lock.json'), { force: true })
  fs.copyFileSync(filePath, `${filePath}.bak`)
  console.log(chalk.greenBright`[+] Backup created at {bold ${filePath}.bak}`)
  console.log(chalk.yellowBright`[+] Building app...`)
  await asar.createPackage(tempPath, filePath)
  fs.rmSync(tempPath, { recursive: true, force: true })
  console.log(chalk.greenBright`[+] App patched`)
}

switch (argv._[0]) {
  case 'patch':
    await patchApp()
    break
  case 'restore':
    try {
      console.log(chalk.blueBright`[+] Restoring app...`)
      if (!fs.existsSync(path.join(appPath, 'app.asar.bak')))
        console.error(chalk.redBright`[-] App not patched or restore file not found`)
      else {
        fs.copyFileSync(path.join(appPath, 'app.asar.bak'), path.join(appPath, 'app.asar'))
        console.log(chalk.greenBright`[+] App restored`)
      }
      fs.rmSync(path.join(os.tmpdir(), 'httptoolkit-patch'), { recursive: true, force: true })
    } catch (e) {
      if (!isSudo && e.errno === -13) { //? Permission denied
        console.error(chalk.redBright`[-] Permission denied${!isWin ? ', try running with sudo' : ', try running node as administrator'}`)
        process.exit(1)
      }
      console.error(chalk.redBright`[-] An error occurred`, e)
      process.exit(1)
    }
    break
  case 'start':
    console.log(chalk.blueBright`[+] Starting HTTP Toolkit...`)
    try {
      execSync(isWin ? `start "" "${path.resolve(appPath, '..', 'HTTP Toolkit.exe')}"` : isMac ? 'open -a "HTTP Toolkit"' : 'httptoolkit', { stdio: 'inherit' })
    } catch (e) {
      console.error(chalk.redBright`[-] An error occurred`, e)
      if (isSudo) console.error(chalk.redBright`[-] Try running without sudo`)
      process.exit(1)
    }
    break
  default:
    console.error(chalk.redBright`[-] Unknown command`)
    process.exit(1)
}

console.log(chalk.greenBright`[+] Done`)
