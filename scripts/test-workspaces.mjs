import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const packages = [
	'metro',
	'metro-oauth2',
	'metro-oidc',
	'metro-oldm',
	'metro-core',
	'metro-api',
	'metro-middleware',
	'metro-formdata',
	'metro-hashparams',
	'metro-trace'
]

const tapBin = process.platform == 'win32'
	? join('node_modules', '.bin', 'tap.cmd')
	: join('node_modules', '.bin', 'tap')

for (const name of packages) {
	const testDir = join('packages', name, 'test')
	if (!existsSync(testDir)) {
		continue
	}
	const files = readdirSync(testDir)
		.filter(file => file.endsWith('.mjs'))
		.sort()
		.map(file => join(testDir, file))

	if (!files.length) {
		continue
	}

	console.log(`\n# ${name}`)
	const result = spawnSync(tapBin, ['--disable-coverage', '--jobs=1', ...files], {
		stdio: 'inherit',
		timeout: 120_000
	})
	if (result.error) {
		console.error(result.error.message)
		process.exit(1)
	}
	if (result.status !== 0) {
		process.exit(result.status || 1)
	}
}
