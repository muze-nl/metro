/**
 * Publishes every package in this repository whose current version is not
 * yet on npm.
 *
 *   npm run release              dry run: checks everything, publishes nothing
 *   npm run release -- --publish publishes for real
 *
 * Before publishing it checks that:
 * - packages already on npm have not changed without a version bump
 * - tracked files have no uncommitted changes, so npm receives committed code
 * - every dependency range can be satisfied by npm or by this release
 * - the tests pass
 * - rebuilding the packages does not change committed files such as dist/
 *
 * Packages are published in dependency order. Published versions are
 * skipped, so after a failure the script can simply be run again.
 */
import {
	readFileSync, readdirSync, existsSync, mkdtempSync, mkdirSync, rmSync
} from 'node:fs'
import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import semver from 'semver'

const root = process.cwd()
const publish = process.argv.includes('--publish')

main()

function main()
{
	const packages = readPackages(root)
	const releases = packages.filter(pkg => !isPublished(pkg))
	const published = packages.filter(pkg => !releases.includes(pkg))
	checkPublishedPackagesAreUnchanged(published)
	if (!releases.length) {
		console.log('release: every package version is already on npm')
		return
	}
	console.log('release: unpublished package versions:')
	for (const pkg of releases) {
		console.log(`  ${pkg.name}@${pkg.version}`)
	}

	checkWorkingTreeIsClean('before release')
	checkDependencies(releases, packages)
	run('npm', ['test'], root)
	buildPackages(releases)
	checkWorkingTreeIsClean('after rebuilding; commit the rebuilt files')

	for (const pkg of orderByDependencies(releases)) {
		publishPackage(pkg)
	}

	if (publish) {
		console.log('release: done')
	}
	else {
		console.log('release: dry run complete; use --publish to publish')
	}
}

/**
 * Reads the root package, or its workspaces when it has them. Private
 * packages, such as a monorepo root, are never published.
 */
function readPackages(dir)
{
	const rootPackage = readPackage(dir)
	let dirs = [dir]
	if (rootPackage.workspaces) {
		dirs = rootPackage.workspaces.flatMap(expandWorkspace)
	}
	const packages = dirs.map(readPackage)
	return packages.filter(pkg => !pkg.private)
}

function expandWorkspace(pattern)
{
	if (!pattern.endsWith('/*')) {
		return [join(root, pattern)]
	}
	if (pattern.slice(0, -2).includes('*')) {
		fail(`unsupported workspace pattern ${pattern}`)
	}
	const parent = join(root, pattern.slice(0, -2))
	return readdirSync(parent, { withFileTypes: true })
		.filter(entry => entry.isDirectory())
		.map(entry => join(parent, entry.name))
		.filter(dir => existsSync(join(dir, 'package.json')))
}

function readPackage(dir)
{
	const json = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
	json.dir = dir
	return json
}

function isPublished(pkg)
{
	const versions = registryVersions(`${pkg.name}@${pkg.version}`)
	return versions.includes(pkg.version)
}

/**
 * Returns the registry versions matching a name@range specifier, or an
 * empty list when npm does not know the package.
 */
function registryVersions(specifier)
{
	const result = spawnSync('npm', ['view', specifier, 'version', '--json'], {
		cwd: root,
		encoding: 'utf8'
	})
	if (result.status !== 0) {
		if (/E404/.test(result.stderr)) {
			return []
		}
		fail(`could not query npm for ${specifier}\n${result.stderr}`)
	}
	if (!result.stdout.trim()) {
		return []
	}
	const versions = JSON.parse(result.stdout)
	if (Array.isArray(versions)) {
		return versions
	}
	return [versions]
}

/**
 * A package that changed after its version was published would otherwise be
 * skipped silently, leaving its changes unreleased. Compares the files npm
 * has for that version with the files this checkout would publish.
 */
function checkPublishedPackagesAreUnchanged(packages)
{
	const workDir = mkdtempSync(join(tmpdir(), 'release-'))
	const problems = []
	try {
		for (const pkg of packages) {
			const specifier = `${pkg.name}@${pkg.version}`
			const publishedDir = unpack(specifier, root, join(workDir, 'npm'))
			const localDir = unpack('.', pkg.dir, join(workDir, 'local'))
			const changed = changedFiles(publishedDir, localDir)
			if (changed.length) {
				problems.push(`${specifier}: ${changed.join(', ')}`)
			}
		}
	}
	finally {
		rmSync(workDir, { recursive: true, force: true })
	}
	if (problems.length) {
		fail('changed since publishing; bump their versions:\n  '
			+ problems.join('\n  '))
	}
}

/**
 * Packs a package (a registry specifier, or '.' for the package in cwd)
 * with npm pack and returns the directory holding its unpacked files.
 */
function unpack(specifier, cwd, destination)
{
	rmSync(destination, { recursive: true, force: true })
	mkdirSync(destination, { recursive: true })
	const result = spawnSync(
		'npm', ['pack', specifier, '--json', '--pack-destination', destination],
		{ cwd, encoding: 'utf8' }
	)
	if (result.status !== 0) {
		fail(`npm pack ${specifier} failed in ${cwd}\n${result.stderr}`)
	}
	const [{ filename }] = JSON.parse(result.stdout)
	run('tar', ['-xzf', filename], destination)
	return join(destination, 'package')
}

function changedFiles(publishedDir, localDir)
{
	const publishedFiles = listFiles(publishedDir)
	const localFiles = listFiles(localDir)
	const names = new Set([...publishedFiles, ...localFiles])
	return [...names].sort().filter(name => {
		if (!publishedFiles.includes(name) || !localFiles.includes(name)) {
			return true
		}
		const publishedContent = readFileSync(join(publishedDir, name))
		const localContent = readFileSync(join(localDir, name))
		return !publishedContent.equals(localContent)
	})
}

function listFiles(dir)
{
	return readdirSync(dir, { recursive: true, withFileTypes: true })
		.filter(entry => entry.isFile())
		.map(entry => relative(dir, join(entry.parentPath ?? entry.path, entry.name)))
}

function checkWorkingTreeIsClean(moment)
{
	const result = spawnSync(
		'git', ['status', '--porcelain', '--untracked-files=no'],
		{ cwd: root, encoding: 'utf8' }
	)
	if (result.status !== 0) {
		fail(`git status failed\n${result.stderr}`)
	}
	if (result.stdout.trim()) {
		fail(`uncommitted changes ${moment}:\n${result.stdout}`)
	}
}

/**
 * A released package must be installable: each dependency range must match
 * either a version released now, or a version already on npm.
 */
function checkDependencies(releases, packages)
{
	const local = new Map(packages.map(pkg => [pkg.name, pkg]))
	const problems = []
	for (const pkg of releases) {
		for (const [name, range] of runtimeDependencies(pkg)) {
			const localPackage = local.get(name)
			const releasedNow = releases.includes(localPackage)
			if (releasedNow && semver.satisfies(localPackage.version, range)) {
				continue
			}
			if (registryVersions(`${name}@${range}`).length) {
				continue
			}
			problems.push(`${pkg.name} needs ${name}@${range}, `
				+ 'which is neither on npm nor part of this release')
		}
	}
	if (problems.length) {
		fail('unsatisfiable dependencies:\n  ' + problems.join('\n  '))
	}
}

function runtimeDependencies(pkg)
{
	return Object.entries({
		...pkg.dependencies,
		...pkg.optionalDependencies,
		...pkg.peerDependencies
	})
}

/**
 * Runs each package's build, then its development build, since both kinds
 * of output may be committed.
 */
function buildPackages(releases)
{
	for (const pkg of releases) {
		const scripts = pkg.scripts ?? {}
		if (scripts.build) {
			run('npm', ['run', 'build'], pkg.dir)
		}
		const devBuild = ['build-dev', 'build:dev'].find(name => scripts[name])
		if (devBuild) {
			run('npm', ['run', devBuild], pkg.dir)
		}
	}
}

/**
 * Orders packages so that each is published after the packages from this
 * release that it depends on.
 */
function orderByDependencies(releases)
{
	const byName = new Map(releases.map(pkg => [pkg.name, pkg]))
	const ordered = []
	const visiting = new Set()

	function visit(pkg)
	{
		if (ordered.includes(pkg)) {
			return
		}
		if (visiting.has(pkg)) {
			fail(`dependency cycle through ${pkg.name}`)
		}
		visiting.add(pkg)
		for (const [name] of runtimeDependencies(pkg)) {
			if (byName.has(name)) {
				visit(byName.get(name))
			}
		}
		visiting.delete(pkg)
		ordered.push(pkg)
	}

	for (const pkg of releases) {
		visit(pkg)
	}
	return ordered
}

/**
 * Scoped packages are private on npm unless published with public access.
 * npm may ask for a one-time password, so the terminal stays attached.
 */
function publishPackage(pkg)
{
	console.log(`\nrelease: publishing ${pkg.name}@${pkg.version}`)
	const args = ['publish', '--access', 'public']
	if (!publish) {
		args.push('--dry-run')
	}
	run('npm', args, pkg.dir)
}

function run(command, args, cwd)
{
	const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
	if (result.error) {
		fail(`${command} ${args.join(' ')}: ${result.error.message}`)
	}
	if (result.status !== 0) {
		fail(`${command} ${args.join(' ')} failed in ${cwd}`)
	}
}

function fail(message)
{
	console.error(`release: ${message}`)
	process.exit(1)
}
