/** Project-specific CI provisioning. Credentials stay in memory and the GitHub secret store. */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const REPO = 'ariel-hi/copysprig';
const PROJECT = 'copysprig';
const ACCOUNT = 'copysprig-deploy';
const SECRET = 'FIREBASE_SERVICE_ACCOUNT_COPYSPRIG';
const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
function fail(message) { throw new Error(message); }

function githubCredential() {
  const credential = spawnSync('git', ['credential', 'fill'], {
    cwd: root,
    input: `protocol=https\nhost=github.com\npath=${REPO}.git\n\n`,
    encoding: 'utf8', env: { ...process.env, GCM_INTERACTIVE: 'never', GIT_TERMINAL_PROMPT: '0' },
  });
  const token = credential.stdout?.split(/\r?\n/).find((line) => line.startsWith('password='))?.slice(9);
  if (credential.status !== 0 || !token) fail('Existing Git credential is unavailable. Authenticate GitHub through Git Credential Manager first.');
  return token;
}

async function main() {
const token = githubCredential();
async function github(path, method = 'GET', body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'CopySprig-project-ci' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) fail(`GitHub ${method} ${path} returned HTTP ${response.status}. No credentials were printed.`);
  return response.status === 204 ? null : response.json();
}
async function pinnedAction(repository, version) {
  let { object } = await github(`/repos/${repository}/git/ref/tags/${version}`);
  while (object.type === 'tag') ({ object } = await github(`/repos/${repository}/git/tags/${object.sha}`));
  if (object.type !== 'commit' || !/^[a-f0-9]{40}$/.test(object.sha)) fail(`Could not pin ${repository}@${version}.`);
  return `${repository}@${object.sha} # ${version}`;
}

if (process.argv.includes('--status')) {
  const { workflow_runs: runs } = await github(`/repos/${REPO}/actions/workflows/deploy.yml/runs?per_page=3`);
  for (const run of runs) {
    const { jobs } = await github(`/repos/${REPO}/actions/runs/${run.id}/jobs`);
    console.log(JSON.stringify({ runId: run.id, url: run.html_url, status: run.status, conclusion: run.conclusion, headSha: run.head_sha, jobs: jobs.map((job) => ({ name: job.name, status: job.status, conclusion: job.conclusion, failedSteps: job.steps.filter((step) => step.conclusion === 'failure').map((step) => step.name) })) }));
  }
  process.exit(0);
}

const repository = await github(`/repos/${REPO}`);
if (repository.full_name !== REPO || !repository.permissions?.admin || repository.private) fail('Expected admin access to the dedicated public CopySprig repository.');
const firebasePath = process.env.COPYSPRIG_FIREBASE_TOOLS_PATH ?? resolve(process.env.APPDATA ?? '', 'npm', 'node_modules', 'firebase-tools');
const load = (module) => require(resolve(firebasePath, 'lib', `${module}.js`));
// The SDK's logger remains completely silent, including debug API bodies.
load('logger').logger.silent = true;
const account = load('auth').getGlobalDefaultAccount();
if (!account) fail('No existing Firebase CLI account is available. Run firebase login first.');
await load('requireAuth').requireAuth({ project: PROJECT, projectId: PROJECT, nonInteractive: true, user: account.user, tokens: account.tokens });
const { Client } = load('apiv2');
const billing = await new Client({ urlPrefix: 'https://cloudbilling.googleapis.com', apiVersion: 'v1' }).get(`/projects/${PROJECT}/billingInfo`);
if (billing.body.billingEnabled) fail('Expected the launch’s unbilled Spark project. Review CI provisioning before proceeding.');
const permissions = await load('gcp/iam').testIamPermissions(PROJECT, ['iam.serviceAccounts.create', 'iam.serviceAccountKeys.create', 'resourcemanager.projects.setIamPolicy']);
if (!permissions.passed) fail('Existing Firebase account lacks required project-specific service-account/IAM permissions.');
const iam = load('gcp/iam');
try {
  await iam.createServiceAccount(PROJECT, ACCOUNT, `Deploy the static CopySprig site from ${REPO}; no unrelated project access.`, 'CopySprig GitHub deployment');
  console.log(`Created dedicated deployment account in ${PROJECT}.`);
} catch (error) {
  if (error.status !== 409 && !String(error.message).includes('409')) fail('Dedicated service-account creation failed; no credentials were printed.');
  console.log('Dedicated deployment account already exists.');
}
for (let attempt = 0; ; attempt++) {
  try {
    await load('gcp/resourceManager').addServiceAccountToRoles(PROJECT, ACCOUNT, ['roles/firebasehosting.admin', 'roles/serviceusage.serviceUsageConsumer', 'roles/serviceusage.apiKeysViewer']);
    break;
  } catch (error) {
    // Newly created service accounts briefly lag in Resource Manager's view.
    if (attempt >= 5 || error.status !== 400 || !/does not exist/i.test(error.message)) throw error;
    await new Promise((done) => setTimeout(done, 1000 * (2 ** attempt)));
  }
}
console.log('Applied only Hosting Admin, Service Usage Consumer and API Keys Viewer in copysprig.');
const { secrets } = await github(`/repos/${REPO}/actions/secrets`);
if (!secrets.some((secret) => secret.name === SECRET)) {
  const publicKey = await github(`/repos/${REPO}/actions/secrets/public-key`);
  const sodium = require(resolve(firebasePath, 'node_modules', 'libsodium-wrappers'));
  await sodium.ready;
  const key = await iam.createServiceAccountKey(PROJECT, ACCOUNT);
  const value = Buffer.from(JSON.stringify(JSON.parse(Buffer.from(key.privateKeyData, 'base64').toString('utf8'))));
  const encrypted = sodium.crypto_box_seal(value, Buffer.from(publicKey.key, 'base64'));
  value.fill(0);
  await github(`/repos/${REPO}/actions/secrets/${SECRET}`, 'PUT', { encrypted_value: Buffer.from(encrypted).toString('base64'), key_id: publicKey.key_id });
  console.log(`Created and encrypted ${SECRET} in the dedicated GitHub repository. No credential file was written.`);
} else console.log(`${SECRET} already exists; did not create another private key.`);
const checkout = await pinnedAction('actions/checkout', 'v4');
const setupNode = await pinnedAction('actions/setup-node', 'v4');
const hosting = await pinnedAction('FirebaseExtended/action-hosting-deploy', 'v0');
const workflow = `name: Verify and deploy CopySprig\n\non:\n  push:\n    branches: [main]\n  workflow_dispatch:\n\npermissions:\n  contents: read\n\nconcurrency:\n  group: copysprig-live\n  cancel-in-progress: false\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    timeout-minutes: 10\n    steps:\n      - uses: ${checkout}\n      - uses: ${setupNode}\n        with:\n          node-version: '24'\n          cache: npm\n      - name: Install locked dependencies\n        run: npm ci\n      - name: Functional and privacy tests\n        run: npm test\n      - name: Build static site\n        run: npm run build\n      - name: Audit indexable build\n        run: npm run check\n      - name: Deploy verified live site\n        uses: ${hosting}\n        with:\n          firebaseServiceAccount: '\${{ secrets.${SECRET} }}'\n          projectId: copysprig\n          channelId: live\n      - name: Verify public production routes\n        run: npm run health\n`;
await mkdir(resolve(root, '.github', 'workflows'), { recursive: true });
await writeFile(resolve(root, '.github', 'workflows', 'deploy.yml'), workflow);
console.log('Wrote .github/workflows/deploy.yml with commit-pinned actions. Commit and push it with the verified source to main.');
console.log(`Workflow status: node scripts/setup-ci.mjs --status. Repository: https://github.com/${REPO}/actions`);
}
main().catch((error) => {
  console.error(`CopySprig CI setup stopped: ${error.status ? `HTTP ${error.status}; review project IAM/API access.` : error.message}`);
  process.exitCode = 1;
});
