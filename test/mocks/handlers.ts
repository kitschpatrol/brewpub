/* eslint-disable ts/naming-convention -- GitHub API response fields. */

import { http, HttpResponse, passthrough } from 'msw'
import { base64ToString, stringToBase64 } from 'uint8array-extras'
import { fakeTap, getBlobSha, getBranchBySha, getBranchSha } from './fixtures/github'
import { registryFixtures } from './fixtures/registry'

const REFS_PREFIX = /^refs\//v
const HEADS_PREFIX = /^heads\//v
const REFS_HEADS_PREFIX = /^refs\/heads\//v
const BASE64_LINE = /.{60}/gv

function shouldMock(): boolean {
	return process.env.BREWPUB_TEST_MOCK !== 'false'
}

function notFound() {
	return HttpResponse.json({ message: 'Not Found' }, { status: 404 })
}

function isFakeTap(owner: string, repo: string): boolean {
	return owner === fakeTap.owner && repo === fakeTap.repo
}

function getRefBranch(ref: string): string | undefined {
	const branch = ref.replace(REFS_PREFIX, '').replace(HEADS_PREFIX, '')
	return fakeTap.branches.has(branch) ? branch : undefined
}

type PutContentsBody = { branch?: string; content: string; message: string; sha?: string }
type PostRefBody = { ref: string; sha: string }
type PostPullBody = { base: string; body?: string; head: string; title: string }

let nextCommitNumber = 1

export const handlers = [
	// ── npm registry ──────────────────────────────────────────

	http.get('https://registry.npmjs.org/:name/:version', ({ params }) => {
		if (!shouldMock()) {
			return passthrough()
		}

		const name = decodeURIComponent(String(params.name))
		const fixture = registryFixtures[`${name}@${String(params.version)}`]
		return fixture === undefined ? notFound() : HttpResponse.json(fixture.manifest)
	}),

	http.get('https://registry.npmjs.org/*/-/:file', ({ request }) => {
		if (!shouldMock()) {
			return passthrough()
		}

		const fixture = Object.values(registryFixtures).find(
			(candidate) => candidate.tarballUrl === request.url,
		)
		return fixture === undefined
			? notFound()
			: HttpResponse.arrayBuffer(fixture.tarballBytes.buffer as ArrayBuffer, {
					headers: { 'content-type': 'application/octet-stream' },
				})
	}),

	// ── GitHub ────────────────────────────────────────────────

	http.get('https://api.github.com/repos/:owner/:repo', ({ params }) => {
		if (!shouldMock()) {
			return passthrough()
		}

		return isFakeTap(String(params.owner), String(params.repo))
			? HttpResponse.json({ default_branch: fakeTap.defaultBranch })
			: notFound()
	}),

	http.get('https://api.github.com/repos/:owner/:repo/git/trees/:sha', ({ params, request }) => {
		if (!shouldMock()) {
			return passthrough()
		}

		const files = fakeTap.branches.get(String(params.sha))
		if (files === undefined || !isFakeTap(String(params.owner), String(params.repo))) {
			return notFound()
		}

		const isRecursive = new URL(request.url).searchParams.get('recursive') === '1'
		const tree = []
		for (const [path, content] of files) {
			if (isRecursive || !path.includes('/')) {
				tree.push({ mode: '100644', path, sha: getBlobSha(content), type: 'blob' })
			}
		}

		return HttpResponse.json({ sha: getBranchSha(String(params.sha)), tree, truncated: false })
	}),

	http.get('https://api.github.com/repos/:owner/:repo/contents/*', ({ params, request }) => {
		if (!shouldMock()) {
			return passthrough()
		}

		const path = String(params[0])
		const ref = new URL(request.url).searchParams.get('ref') ?? fakeTap.defaultBranch
		const files = fakeTap.branches.get(ref)
		if (files === undefined || !isFakeTap(String(params.owner), String(params.repo))) {
			return notFound()
		}

		const content = files.get(path)
		if (content === undefined) {
			const directoryEntries: string[] = []
			for (const candidate of files.keys()) {
				if (candidate.startsWith(`${path}/`)) {
					directoryEntries.push(candidate)
				}
			}

			return directoryEntries.length > 0
				? HttpResponse.json(directoryEntries.map((entry) => ({ path: entry, type: 'file' })))
				: notFound()
		}

		return HttpResponse.json({
			content: stringToBase64(content).replaceAll(BASE64_LINE, '$&\n'),
			encoding: 'base64',
			name: path.split('/').at(-1),
			path,
			sha: getBlobSha(content),
			size: content.length,
			type: 'file',
		})
	}),

	http.put('https://api.github.com/repos/:owner/:repo/contents/*', async ({ params, request }) => {
		if (!shouldMock()) {
			return passthrough()
		}

		const path = String(params[0])
		const body = (await request.json()) as PutContentsBody
		const branch = body.branch ?? fakeTap.defaultBranch
		const files = fakeTap.branches.get(branch)
		if (files === undefined || !isFakeTap(String(params.owner), String(params.repo))) {
			return notFound()
		}

		const existing = files.get(path)
		if (existing !== undefined && body.sha !== getBlobSha(existing)) {
			return HttpResponse.json({ message: 'sha does not match' }, { status: 409 })
		}

		if (existing === undefined && body.sha !== undefined) {
			return HttpResponse.json({ message: 'Invalid request: sha for new file' }, { status: 422 })
		}

		const content = base64ToString(body.content)
		files.set(path, content)
		const sha = `commit${String(nextCommitNumber++).padStart(4, '0')}`
		fakeTap.commits.push({ branch, message: body.message, path, sha })

		return HttpResponse.json(
			{
				commit: {
					html_url: `https://github.com/${fakeTap.owner}/${fakeTap.repo}/commit/${sha}`,
					sha,
				},
				content: { path, sha: getBlobSha(content) },
			},
			{ status: existing === undefined ? 201 : 200 },
		)
	}),

	http.get('https://api.github.com/repos/:owner/:repo/git/ref/*', ({ params }) => {
		if (!shouldMock()) {
			return passthrough()
		}

		const branch = getRefBranch(String(params[0]))
		return branch === undefined || !isFakeTap(String(params.owner), String(params.repo))
			? notFound()
			: HttpResponse.json({
					object: { sha: getBranchSha(branch), type: 'commit' },
					ref: `refs/heads/${branch}`,
				})
	}),

	http.post('https://api.github.com/repos/:owner/:repo/git/refs', async ({ params, request }) => {
		if (!shouldMock()) {
			return passthrough()
		}

		if (!isFakeTap(String(params.owner), String(params.repo))) {
			return notFound()
		}

		const body = (await request.json()) as PostRefBody
		const branch = body.ref.replace(REFS_HEADS_PREFIX, '')
		const source = getBranchBySha(body.sha)
		if (source === undefined) {
			return HttpResponse.json({ message: 'Object does not exist' }, { status: 422 })
		}

		if (fakeTap.branches.has(branch)) {
			return HttpResponse.json({ message: 'Reference already exists' }, { status: 422 })
		}

		fakeTap.branches.set(branch, new Map(fakeTap.branches.get(source)))
		return HttpResponse.json(
			{ object: { sha: getBranchSha(branch), type: 'commit' }, ref: body.ref },
			{ status: 201 },
		)
	}),

	http.get('https://api.github.com/repos/:owner/:repo/pulls', ({ params, request }) => {
		if (!shouldMock()) {
			return passthrough()
		}

		if (!isFakeTap(String(params.owner), String(params.repo))) {
			return notFound()
		}

		const { searchParams } = new URL(request.url)
		const head = searchParams.get('head')?.split(':').at(-1)
		const state = searchParams.get('state') ?? 'open'
		const matches = fakeTap.pullRequests
			.filter((pullRequest) => head === undefined || pullRequest.head === head)
			.filter((pullRequest) => state === 'all' || pullRequest.state === state)
			.map((pullRequest) => ({ html_url: pullRequest.htmlUrl, number: pullRequest.number }))

		return HttpResponse.json(matches)
	}),

	http.post('https://api.github.com/repos/:owner/:repo/pulls', async ({ params, request }) => {
		if (!shouldMock()) {
			return passthrough()
		}

		if (!isFakeTap(String(params.owner), String(params.repo))) {
			return notFound()
		}

		const body = (await request.json()) as PostPullBody
		const number = fakeTap.pullRequests.length + 1
		const htmlUrl = `https://github.com/${fakeTap.owner}/${fakeTap.repo}/pull/${number}`
		fakeTap.pullRequests.push({
			base: body.base,
			body: body.body ?? '',
			head: body.head,
			htmlUrl,
			number,
			state: 'open',
			title: body.title,
		})

		return HttpResponse.json({ html_url: htmlUrl, number }, { status: 201 })
	}),
]
