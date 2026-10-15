const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../../public/js/controllers/ContractController.js'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  let controller;
  let compilerUrl;
  let body;
  let fail = false;
  const buttons = [];
  const scope = {};
  const jquery = () => ({ button: state => buttons.push(state) });
  jquery.each = (entries, callback) => entries.forEach((value, index) => callback(index, value));
  const http = (request) => {
    body = request.data;
    return fail ? Promise.reject(new Error('offline')) : Promise.resolve({ data: { valid: true } });
  };
  http.get = (url) => {
    compilerUrl = url;
    return Promise.resolve({ data: { builds: [{ version: '0.8.28', longVersion: '0.8.28+commit.7893614a' }] } });
  };
  vm.runInNewContext(source, {
    angular: { module: () => ({ controller: (name, callback) => { controller = callback; } }) },
    $: jquery,
    isAddress: address => /^0x[0-9a-f]{40}$/i.test(address),
    console: { log: () => {} },
  });
  controller({ addr: '0x39395b6aefcfe1f4a81e9ed5ce6a5b59be784493' },
    { $state: { current: { data: {} } }, settings: { path: '/explorer/' } }, scope, http);
  return {
    scope, buttons, getUrl: () => compilerUrl, getBody: () => body, fail: () => { fail = true; },
  };
}

describe('Contract verification form', () => {
  it('loads the official compiler list and starts in legacy-compatible single-file mode', async () => {
    const form = setup();
    await flush();
    assert.strictEqual(form.getUrl(), 'https://binaries.soliditylang.org/bin/list.json');
    assert.strictEqual(form.scope.compilerVersions[0].value, 'v0.8.28+commit.7893614a');
    assert.strictEqual(form.scope.contract.inputFormat, 'solidity');
  });

  it('submits the selected JSON format, compiler and complete input without changing it', async () => {
    const form = setup();
    const code = fs.readFileSync(path.join(__dirname, '../../public/contracts/mintme-erc20-v2-0.8.28.json'), 'utf8');
    Object.assign(form.scope.contract, {
      inputFormat: 'standard-json',
      name: 'ERC20Token',
      version: 'v0.8.28+commit.7893614a',
      code,
    });
    form.scope.submitCode();
    await flush();
    assert.strictEqual(form.getBody().code, code);
    assert.strictEqual(form.getBody().inputFormat, 'standard-json');
    assert.strictEqual(form.getBody().action, 'compile');
    assert.strictEqual(form.scope.contract.compiled, true);
    assert.strictEqual(form.buttons[form.buttons.length - 1], 'reset');
  });

  it('does not submit missing input and lets the user retry a failed request', async () => {
    const form = setup();
    form.scope.submitCode();
    assert.strictEqual(form.getBody(), undefined);
    Object.assign(form.scope.contract, { name: 'Token', version: 'latest', code: 'contract Token {}' });
    form.fail();
    form.scope.submitCode();
    await flush();
    assert(form.scope.errors.code.includes('try again'));
    assert.strictEqual(form.buttons[form.buttons.length - 1], 'reset');
  });
});
