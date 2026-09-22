#!/usr/bin/env node

import { createLogger } from 'lognow'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import {
	bin as packageBin,
	name as packageName,
	version,
} from '../../package.json' with { type: 'json' }
import { formatPublishFormulaResult, publishFormula, setLogger } from '../lib'
import {
	binOption,
	branchOption,
	cwdOption,
	descriptionOption,
	dryRunOption,
	forceOption,
	jsonOption,
	nameOption,
	pathOption,
	prOption,
	registryOption,
	tapOption,
	timeoutOption,
	tokenOption,
	verboseOption,
} from './options'

function createCliLogger(isVerbose: boolean) {
	return createLogger({
		logToConsole: { showLevel: false, showName: false, showTime: false },
		name: packageName,
		verbose: isVerbose,
	})
}

let log = createCliLogger(false)
setLogger(log)

const cliCommandName = Object.keys(packageBin).at(0)!
const yargsInstance = yargs(hideBin(process.argv))

try {
	await yargsInstance
		.scriptName(cliCommandName)
		.env('BREWPUB')
		.option(verboseOption)
		.middleware((argv) => {
			log = createCliLogger(argv.verbose)
			setLogger(log)
		})
		.command(
			'$0',
			'Create or update a Homebrew formula for a published npm package in a GitHub-hosted tap. Run it after `npm publish`.',
			(commandYargs) =>
				commandYargs
					.option(tapOption)
					.option(cwdOption)
					.option(pathOption)
					.option(nameOption)
					.option(binOption)
					.option(descriptionOption)
					.option(tokenOption)
					.option(prOption)
					.option(branchOption)
					.option(forceOption)
					.option(dryRunOption)
					.option(jsonOption)
					.option(registryOption)
					.option(timeoutOption),
			async ({
				bin,
				branch,
				cwd,
				description,
				dryRun,
				force,
				json,
				name,
				path,
				pr,
				registry,
				tap,
				timeout,
				token,
				verbose,
			}) => {
				const result = await publishFormula({
					bin,
					branch,
					cwd,
					description,
					dryRun,
					force,
					name,
					path,
					pr,
					registryUrl: registry,
					tap,
					timeoutMs: timeout * 1000,
					token,
				})

				if (json) {
					process.stdout.write(JSON.stringify(result, undefined, 2) + '\n')
					return
				}

				if (dryRun) {
					process.stdout.write(result.formula.content)
				}

				process.stderr.write(formatPublishFormulaResult(result, verbose) + '\n')
			},
		)
		.alias('h', 'help')
		.version(version)
		.alias('v', 'version')
		.help()
		.strict()
		.wrap(process.stdout.isTTY ? Math.min(120, yargsInstance.terminalWidth()) : 0)
		.fail(false)
		.parse()
} catch (error) {
	log.error(error instanceof Error ? error.message : String(error))
	process.exitCode = 1
}
