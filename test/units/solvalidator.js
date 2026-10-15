const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const solc = require('solc');
const snapshot = require('solc-v2');
const legacySoljson = require('solc-legacy/soljson');

const legacy = solc.setupMethods(legacySoljson);

// Isolate the compiler from MongoDB and the RPC connection created by web3relay on import.
const paths = ['../../routes/web3relay', '../../routes/contracts', '../../tools/solvalidator', '../../routes/compiler']
  .map(name => require.resolve(name));
const saved = paths.map(name => require.cache[name]);
const eth = { getCode: () => '' };
const published = [];
require.cache[paths[0]] = { exports: { eth } };
require.cache[paths[1]] = { exports: { addContract: async data => published.push(data) } };
delete require.cache[paths[2]];
delete require.cache[paths[3]];
const { SolValidator } = require('../../tools/solvalidator');
const compilerRoute = require('../../routes/compiler');

paths.forEach((name, index) => {
  if (saved[index]) require.cache[name] = saved[index];
  else delete require.cache[name];
});

const read = filename => fs.readFileSync(path.join(__dirname, filename), 'utf8');
const bundle = read('../../public/contracts/mintme-erc20-v2-0.8.28.json');
const runtime = read('../fixtures/expertize-runtime.txt').trim();
const version = 'v0.8.28+commit.7893614a';

function request(body) {
  return new Promise((resolve) => {
    let response = '';
    compilerRoute({ body }, { write: (chunk) => { response += chunk; }, end: () => resolve(JSON.parse(response)) });
  });
}

describe('Contract verification', function () {
  this.timeout(15000);
  let originalLoader;
  before(() => {
    originalLoader = solc.loadRemoteVersion;
    solc.loadRemoteVersion = (requested, callback) => {
      if (requested === version) callback(null, snapshot);
      else if (legacy && requested === 'v0.4.18+commit.9cf6e910') callback(null, legacy);
      else callback(new Error('Compiler unavailable'));
    };
  });
  after(() => { solc.loadRemoteVersion = originalLoader; });
  beforeEach(() => { published.length = 0; eth.getCode = () => runtime; });

  it('verifies and publishes the exact Expertize v2 sources through the route', async () => {
    const result = await request({
      action: 'compile',
      address: '0x39395b6aefcfe1f4a81e9ed5ce6a5b59be784493',
      name: 'ERC20Token',
      version,
      inputFormat: 'standard-json',
      code: bundle,
      optimization: true,
    });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.optimization, false);
    assert.strictEqual(result.sourceCode, bundle);
    assert.strictEqual(published.length, 1);
    assert.strictEqual(published[0].byteCode, runtime.slice(2));
    const creation = result.verifiedContracts.find(contract => contract.name === 'ERC20Token').bytecode;
    assert.strictEqual(crypto.createHash('sha256').update(Buffer.from(creation, 'hex')).digest('hex'),
      '9d2d98e33f5c8df15010c3e2acb8199de9fb22ffa1b9070e3c095337b4c44538');
  });

  it('keeps original paths and settings without injecting an extra Solidity source', () => {
    const validator = new SolValidator({ name: 'ERC20Token', version, optimization: true }).addStandardJson(bundle);
    const input = JSON.parse(bundle);
    assert.deepStrictEqual(validator.solSources, input.sources);
    assert.strictEqual(validator.solSettings.evmVersion, 'paris');
    assert.deepStrictEqual(validator.solSettings.optimizer, input.settings.optimizer);
    assert.strictEqual(Object.keys(validator.solSources).length, 7);
  });

  it('rejects a changed compiler target without publishing', async () => {
    const input = JSON.parse(bundle);
    input.settings.evmVersion = 'cancun';
    const result = await request({
      action: 'compile',
      name: 'ERC20Token',
      version,
      inputFormat: 'standard-json',
      code: JSON.stringify(input),
    });
    assert.strictEqual(result.valid, false);
    assert.strictEqual(published.length, 0);
  });

  it('rejects a bytecode mismatch, including modified modern metadata', async () => {
    eth.getCode = () => `${runtime.slice(0, -10)}0000000000`;
    const result = await request({
      action: 'compile',
      name: 'ERC20Token',
      version,
      inputFormat: 'standard-json',
      code: bundle,
    });
    assert.strictEqual(result.valid, false);
    assert.strictEqual(published.length, 0);
  });

  it('returns JSON for malformed input and never publishes', async () => {
    const result = await request({
      action: 'compile',
      name: 'ERC20Token',
      version,
      inputFormat: 'standard-json',
      code: '{',
    });
    assert.strictEqual(result.valid, false);
    assert(result.error);
    assert.strictEqual(published.length, 0);
  });

  it('requires inline sources rather than remote source URLs', () => {
    assert.throws(() => new SolValidator({ name: 'Token' }).addStandardJson(JSON.stringify({
      language: 'Solidity', sources: { 'Token.sol': { urls: ['https://example.com/Token.sol'] } },
    })), /all source files/);
  });

  it('rejects ambiguous contract names across Standard JSON source files', () => {
    const validator = new SolValidator({ name: 'Token' });
    validator.standardJson = true;
    validator.compiledSols = { contracts: { 'A.sol': { Token: {} }, 'B.sol': { Token: {} } } };
    assert.throws(() => validator.validateSolcOutput(), /exactly one/);
  });

  it('propagates compiler download and RPC failures instead of leaving requests pending', async () => {
    const validator = new SolValidator({ name: 'Token', version: 'unavailable' });
    await assert.rejects(validator.getSolcSnapshot(), /Compiler unavailable/);
    eth.getCode = () => { throw new Error('RPC unavailable'); };
    await assert.rejects(validator.setByteCode(), /RPC unavailable/);
  });

  it('keeps single-file verification and latest local compiler support', async () => {
    const code = 'pragma solidity >=0.8.0; contract Token {}';
    const local = new SolValidator({ name: 'Token', version: 'latest' }).addSource('Token.sol', code);
    await local.compileSources();
    local.validateSolcOutput();
    eth.getCode = () => `0x${local.contractSolc.evm.deployedBytecode.object}`;
    assert.strictEqual((await request({
      action: 'compile', name: 'Token', version: 'latest', code,
    })).valid, true);
  });

  it('keeps Solidity 0.4.18 and legacy Swarm metadata compatibility', async () => {
    const code = read('../fixtures/legacy-token.sol');
    const validator = new SolValidator({ name: 'Token', version: 'v0.4.18+commit.9cf6e910' }).addSource('Token.sol', code);
    await validator.compileSources();
    validator.validateSolcOutput();
    const deployed = validator.contractSolc.evm.deployedBytecode.object;
    eth.getCode = () => `0x${deployed.replace(/a165627a7a72305820[0-9a-f]{64}0029$/, `a165627a7a72305820${'1'.repeat(64)}0029`)}`;
    const result = await request({
      action: 'compile', name: 'Token', version: 'v0.4.18+commit.9cf6e910', code,
    });
    assert.strictEqual(result.valid, true);
  });
});
