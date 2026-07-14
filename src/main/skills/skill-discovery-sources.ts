import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import type { SkillDiscoverySource, SkillProvider, SkillSourceKind } from '../../shared/skills'
import type { Repo } from '../../shared/types'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'

export type SkillScanRoot = Omit<SkillDiscoverySource, 'exists' | 'skippedReason'>

export function stablePathId(pathValue: string): string {
  return createHash('sha1').update(pathValue).digest('hex').slice(0, 16)
}

function source(
  id: string,
  label: string,
  path: string,
  sourceKind: SkillSourceKind,
  providers: SkillProvider[]
): SkillScanRoot {
  return { id, label, path, sourceKind, providers }
}

export function buildSkillDiscoverySources(
  args: {
    homeDir?: string
    cwd?: string
    repos?: Repo[]
    includeCwd?: boolean
  } = {}
): SkillScanRoot[] {
  const home = args.homeDir ?? homedir()
  const cwd = args.cwd ?? process.cwd()
  const roots: SkillScanRoot[] = [
    source('home-codex', 'Codex home', join(home, '.codex', 'skills'), 'home', ['codex']),
    source('home-agents', 'Agent skills home', join(home, '.agents', 'skills'), 'home', [
      'agent-skills'
    ]),
    source('home-claude', 'Claude home', join(home, '.claude', 'skills'), 'home', ['claude']),
    source(
      'codex-plugin-cache',
      'Codex plugin cache',
      join(home, '.codex', 'plugins', 'cache'),
      'plugin',
      ['codex', 'agent-skills']
    )
  ]

  const projectPaths = new Set<string>()
  for (const repo of args.repos ?? []) {
    // Why: runtime-owned repos can have no legacy connectionId while their
    // paths are meaningful only on a remote host.
    if (getRepoExecutionHostId(repo) !== LOCAL_EXECUTION_HOST_ID) {
      continue
    }
    projectPaths.add(repo.path)
  }
  if (args.includeCwd !== false) {
    projectPaths.add(cwd)
  }

  for (const repoPath of projectPaths) {
    const label = `Repo ${basename(repoPath)}`
    roots.push(
      source(
        `repo-agents-${stablePathId(repoPath)}`,
        `${label} .agents`,
        join(repoPath, '.agents', 'skills'),
        'repo',
        ['agent-skills']
      ),
      source(
        `repo-claude-${stablePathId(repoPath)}`,
        `${label} .claude`,
        join(repoPath, '.claude', 'skills'),
        'repo',
        ['claude']
      )
    )
  }

  return roots
}
