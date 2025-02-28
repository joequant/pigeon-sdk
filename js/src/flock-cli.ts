#!/usr/bin/env node
// SPDX-License-Identifier: MIT

import readline from 'readline'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { createLogger, format, transports } from 'winston'
import JSON5 from 'json5'
import { mySplit } from './flock-util'
import { FlockConnection } from './flock-connection'

const myTransports = {
  file: new transports.File({ filename: 'cli.log' }),
  console: new transports.Console()
}

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.splat(),
    format.simple()
  ),
  transports: [
    myTransports.file,
    myTransports.console
  ]
})

export class FlockCli {
  sockList: Map<string, FlockConnection>
  ports: Map<string, string>
  readInput: boolean
  rl
  constructor () {
    this.sockList = new Map<string, FlockConnection>()
    this.ports = new Map<string, string>()
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    this.readInput = true
  }

  async send (command: string): Promise<any> {
    const [cmdfull, datafull] = mySplit(command, ' ', 2)
    let data
    if (datafull[0] === '[' || datafull[0] === '{' ||
        datafull[0] === '"' || datafull[0] === '\'') {
      try {
        data = JSON5.parse(datafull)
      } catch (e) {
        return e
      }
    } else {
      data = datafull
    }
    if (cmdfull === '.exit') {
      this.portDisconnectAll()
      this.readInput = false
      return ''
    } else if (cmdfull === '.port-connect') {
      const [name, port] = mySplit(data, ' ', 2)
      return await this.portConnect(name, port)
    } else if (cmdfull === '.port-disconnect') {
      return await this.portDisconnect(data)
    } else if (cmdfull === '.port-list') {
      return await this.portList()
    }

    const [cmd2, subcmd] = mySplit(cmdfull, '.', 2)
    let cmd: string, port: string
    if (cmd2.includes('/')) {
      [port, cmd] = mySplit(cmd2, '/', 2)
    } else {
      cmd = cmd2
      port = 'default'
    }
    if (this.sockList.get(port) === undefined) {
      return 'no connection'
    }
    const result = await this.sockList.get(port)?.send({
      cmd: cmd,
      subcmd: subcmd,
      data: data
    })
    return result
  }

  async portConnect (name: string, port: string): Promise<any> {
    let mySock = this.sockList.get(name)
    if (mySock === undefined) {
      mySock = new FlockConnection({ prefix: 'tcp://127.0.0.1' })
      this.sockList.set(name, mySock)
    } else {
      mySock.disconnect()
    }
    this.ports.set(name, port)
    mySock.connect(port, null)
    logger.log('info', 'Cli %s bound to %s', name, port)
  }

  async portDisconnect (name: string): Promise<any> {
    logger.log('info', 'closing port %s', name)
    const mySock = this.sockList.get(name)
    if (mySock !== undefined) {
      mySock.disconnect()
      this.sockList.delete(name)
      this.ports.delete(name)
    }
  }

  async portDisconnectAll (): Promise<any> {
    for (const name in this.ports.keys()) {
      this.portDisconnect(name)
    }
  }

  async portList (): Promise<any> {
    return Object.fromEntries(this.ports)
  }

  async readline (): Promise<void> {
    this.rl.question('Cli> ', async (answer) => {
      console.log(await this.send(answer))
      if (this.readInput) {
        this.readline()
      }
    })
  }

  async run () : Promise<void> {
    console.log(await this.send('version'))
    await this.readline()
  }
}

if (typeof require !== 'undefined' && require.main === module) {
  // eslint-disable-next-line no-unused-vars
  const argv = yargs(hideBin(process.argv)).command(
    '$0 [port]',
    'the default command',
    (yargs) => {
      return yargs.positional('port', {
        describe: 'port value',
        type: 'string',
        default: 'tcp://127.0.0.1:3000'
      })
    },
    (argv) => {
      const cli = new FlockCli()
      cli.portConnect('default', argv.port).then(() => cli.run())
    }).argv
}
