import { execFile } from 'node:child_process'

import { tmuxPane } from '../../core/tmux.ts'
import { modJxfTmuxSpinner } from './extension.ts'

export default modJxfTmuxSpinner({
  pane: tmuxPane(process.env.TMUX, process.env.TMUX_PANE),
  run: ([file, ...args]) => new Promise(resolve => execFile(file, args, () => resolve())),
})
