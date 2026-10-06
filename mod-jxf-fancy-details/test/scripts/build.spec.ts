import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

const BUILD = join(import.meta.dirname, '../../scripts/build.ts')
const VERSION = '0.3.20261005120000'
const build = (...args: string[]) => spawnSync(process.execPath, [BUILD, ...args], { encoding: 'utf8' })
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'))

let scratch: string

before(async () => {
  scratch = await mkdtemp(join(tmpdir(), 'build-spec-'))
})

after(() => rm(scratch, { recursive: true, force: true }))

test('--harness claude writes a Claude Code plugin with the given version', async () => {
  const out = join(scratch, 'claude')

  assert.equal(build('--harness', 'claude', '--out', out, '--version', VERSION).status, 0)
  const { name, version } = await readJson(join(out, '.claude-plugin', 'plugin.json'))
  assert.deepEqual({ name, version }, { name: 'mod-jxf-fancy-details', version: VERSION })
})

test('--harness pi writes a Pi package with the given version', async () => {
  const out = join(scratch, 'pi')

  assert.equal(build('--harness', 'pi', '--out', out, '--version', VERSION).status, 0)
  const { version, keywords, pi } = await readJson(join(out, 'package.json'))
  assert.equal(version, VERSION)
  assert.ok(keywords.includes('pi-package'))
  assert.ok(pi)
})

test('an unknown harness fails with the usage', () => {
  const { status, stderr } = build('--harness', 'claude-code', '--out', join(scratch, 'unknown'), '--version', VERSION)

  assert.notEqual(status, 0)
  assert.match(stderr, /usage: .*--harness <claude\|pi>/)
})

for (const missing of ['--out', '--version']) {
  test(`a build without ${missing} fails with the usage`, () => {
    const args = { '--harness': 'pi', '--out': join(scratch, 'missing'), '--version': VERSION }
    const { status, stderr } = build(...Object.entries(args).filter(([flag]) => flag !== missing).flat())

    assert.notEqual(status, 0)
    assert.match(stderr, /usage: /)
  })
}
