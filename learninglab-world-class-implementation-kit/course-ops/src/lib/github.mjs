import 'dotenv/config'

const API_BASE = process.env.GITHUB_API_URL || 'https://api.github.com'

export function createGitHubClient() {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    throw new Error('Missing GITHUB_TOKEN')
  }

  async function request(path, init = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      method: init.method || 'GET',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.headers || {})
      },
      body: init.body ? JSON.stringify(init.body) : undefined
    })

    const text = await response.text()
    const maybeJson = text ? tryParseJson(text) : null

    if (!response.ok) {
      const detail = maybeJson?.message || text || response.statusText
      const error = new Error(`GitHub API ${response.status} ${detail}`)
      error.status = response.status
      error.body = maybeJson
      throw error
    }

    return maybeJson
  }

  return {
    request
  }
}

export async function createRepoFromTemplate(client, {
  templateOwner,
  templateRepo,
  owner,
  name,
  description,
  isPrivate = true,
  includeAllBranches = false
}) {
  return client.request(`/repos/${templateOwner}/${templateRepo}/generate`, {
    method: 'POST',
    body: {
      owner,
      name,
      description,
      private: isPrivate,
      include_all_branches: includeAllBranches
    }
  })
}

export async function getRepository(client, { owner, repo }) {
  return client.request(`/repos/${owner}/${repo}`)
}

export function assertRepositoryReusable(repository, { owner, repo, expectedVisibility }) {
  const expectedFullName = `${owner}/${repo}`
  const problems = []

  if (!repository || repository.full_name !== expectedFullName) {
    problems.push(`expected repository ${expectedFullName}`)
  }

  if (repository?.archived) {
    problems.push('repository is archived')
  }

  if (repository?.disabled) {
    problems.push('repository is disabled')
  }

  if (expectedVisibility === 'private' && !repository?.private) {
    problems.push('repository is public but private visibility is required')
  }

  if (expectedVisibility === 'public' && repository?.private) {
    problems.push('repository is private but public visibility is required')
  }

  if (problems.length > 0) {
    throw new Error(`Existing repository ${expectedFullName} is not safe to reuse: ${problems.join('; ')}`)
  }

  return repository
}

export async function upsertRepositoryVariable(client, { owner, repo, name, value }) {
  try {
    await client.request(`/repos/${owner}/${repo}/actions/variables/${name}`, {
      method: 'PATCH',
      body: { name, value }
    })
    return { action: 'updated' }
  } catch (error) {
    if (error.status !== 404) throw error
  }

  await client.request(`/repos/${owner}/${repo}/actions/variables`, {
    method: 'POST',
    body: { name, value }
  })
  return { action: 'created' }
}

export async function getRepositoryVariable(client, { owner, repo, name }) {
  try {
    const variable = await client.request(`/repos/${owner}/${repo}/actions/variables/${name}`)
    return variable?.value || null
  } catch (error) {
    if (error.status === 404) return null
    throw error
  }
}

export async function addCollaborator(client, { owner, repo, username, permission = 'push' }) {
  try {
    await client.request(`/repos/${owner}/${repo}/collaborators/${username}`, {
      method: 'PUT',
      body: { permission }
    })
    return { action: 'invited_or_updated' }
  } catch (error) {
    throw error
  }
}

export async function replaceTopics(client, { owner, repo, names }) {
  return client.request(`/repos/${owner}/${repo}/topics`, {
    method: 'PUT',
    headers: {
      'Accept': 'application/vnd.github+json'
    },
    body: { names }
  })
}

export async function fetchLatestWorkflowRun(client, { owner, repo, workflowFile, branch = 'main' }) {
  const result = await client.request(`/repos/${owner}/${repo}/actions/workflows/${workflowFile}/runs?branch=${encodeURIComponent(branch)}&per_page=1`)
  return result?.workflow_runs?.[0] || null
}

function tryParseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
