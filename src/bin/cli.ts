#!/usr/bin/env node

import { log, setDefaultLogOptions } from 'lognow'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { bin, version } from '../../package.json' with { type: 'json' }
import { doSomething, doSomethingElse, setLogger } from '../lib'

setLogger(log)

const cliCommandName = Object.keys(bin).at(0)!
const yargsInstance = yargs(hideBin(process.argv))

await yargsInstance
	.scriptName(cliCommandName)
	.usage('$0 [command]', `Run a ${cliCommandName} command.`)
	.option('verbose', {
		default: false,
		description: 'Run with verbose logging',
		type: 'boolean',
	})
	.middleware((argv) => {
		// Set log level globally based on verbose flag
		setDefaultLogOptions({ verbose: argv.verbose })
	})
	.command(
		['$0', 'do-something'],
		'Run the do-something command.',
		() => {
			// Options go here
		},
		() => {
			log.debug('Running command...')
			process.stdout.write(doSomething() + '\n')
		},
	)
	.command(
		'do-something-else',
		'Run the do-something-else command.',
		() => {
			// Options go here
		},
		() => {
			log.debug('Running command...')
			process.stdout.write(doSomethingElse() + '\n')
		},
	)
	.alias('h', 'help')
	.version(version)
	.alias('v', 'version')
	.help()
	.strict()
	.wrap(process.stdout.isTTY ? Math.min(120, yargsInstance.terminalWidth()) : 0)
	.parse()
