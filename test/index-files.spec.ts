import assert from 'node:assert/strict'
import { test } from 'node:test'

import { recordRelease } from '../scripts/lib/index-files.ts'

test('releases are kept in plugin name order and other harnesses are kept', () => {
  let releases = recordRelease({}, 'zeta', 'Zeta.', 'pi', { repo: 'fj/z-pi', version: '0.1.1' })
  releases = recordRelease(releases, 'alpha', 'Alpha.', 'claude', { repo: 'fj/a-claude', version: '0.1.1' })
  releases = recordRelease(releases, 'zeta', 'Zeta, renamed.', 'claude', { repo: 'fj/z-claude', version: '0.1.2' })

  assert.deepEqual(Object.keys(releases), ['alpha', 'zeta'])
  assert.deepEqual(releases.zeta, {
    description: 'Zeta, renamed.',
    pi: { repo: 'fj/z-pi', version: '0.1.1' },
    claude: { repo: 'fj/z-claude', version: '0.1.2' },
  })
})
