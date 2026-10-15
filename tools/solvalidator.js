const solc = require('solc');
const { eth } = require('../routes/web3relay');

class SolValidator {
  constructor(configs) {
    this.contractAddress = configs.address;
    this.contractName = configs.name;
    this.contracSource = `${this.contractName}.sol`;
    this.contractBytecode = null;
    this.contractSolc = null;
    this.solVersion = configs.version;
    this.solSources = configs.sources || {};
    this.solSettings = configs.settings || {
      outputSelection: { '*': { '*': ['*'] } },
    };
    this.solOptimizer = configs.optimization;
    this.compiledSols = null;
    this.standardJson = false;
  }

  set solOptimizer(active) {
    if (active) this.addSetting('optimizer', { enabled: true, runs: 200 });
  }

  get solcInput() {
    return { language: 'Solidity', sources: this.solSources, settings: this.solSettings };
  }

  addSource(name, content) {
    this.solSources[name] = { content };
    return this;
  }

  addStandardJson(code) {
    const input = JSON.parse(code);
    if (!input || input.language !== 'Solidity' || !input.sources ||
        Array.isArray(input.sources) || typeof input.sources !== 'object' ||
        Object.keys(input.sources).length === 0 ||
        Object.values(input.sources).some(source => !source || typeof source.content !== 'string')) {
      throw new Error('Provide Solidity Standard JSON with all source files included as content.');
    }
    if (input.settings !== undefined &&
        (!input.settings || Array.isArray(input.settings) || typeof input.settings !== 'object')) {
      throw new Error('Standard JSON settings must be an object.');
    }
    this.standardJson = true;
    this.solSources = input.sources;
    this.solSettings = input.settings || {};
    // Output selection does not affect bytecode or metadata. Verification needs both bytecode forms.
    this.solSettings.outputSelection = {
      '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] },
    };
    return this;
  }

  addSetting(name, content) {
    this.solSettings[name] = content;
    return this;
  }

  async setByteCode() {
    this.contractBytecode = (await eth.getCode(this.contractAddress)).replace(/^0x/, '');
  }

  async validate() {
    await this.setByteCode();
    await this.compileSources();
    this.validateSolcOutput();
    this.compareSources();
    return this;
  }

  getSolcSnapshot(version = this.solVersion) {
    return new Promise((resolve, reject) => {
      solc.loadRemoteVersion(version, (err, snapshot) => {
        if (err) reject(err);
        else resolve(snapshot);
      });
    });
  }

  async compileSources(solcSnapshot = solc) {
    let compiler = solcSnapshot;
    const localVersion = compiler.version().split('.Emscripten')[0];
    if (this.solVersion !== 'latest' && this.solVersion.replace(/^v/, '') !== localVersion) {
      compiler = await this.getSolcSnapshot();
    }
    this.compiledSols = JSON.parse(compiler.compile(JSON.stringify(this.solcInput)));
  }

  validateSolcOutput() {
    const errors = (this.compiledSols.errors || []).filter(error => error.severity === 'error');
    if (errors.length) throw new Error(errors.map(error => error.formattedMessage).join('\n'));
    const contracts = this.compiledSols.contracts || {};
    const matches = this.standardJson ?
      Object.values(contracts).filter(source => source[this.contractName]) :
      [contracts[this.contracSource]].filter(source => source && source[this.contractName]);
    if (matches.length !== 1) {
      throw new Error('The contract name must identify exactly one compiled contract.');
    }
    this.contractSolc = matches[0][this.contractName];
  }

  compareSources() {
    if (!this.contractBytecode) throw new Error('No contract exists at this address.');
    // Retain support for legacy Solidity Swarm metadata; compare the actual runtime, not creation code.
    const clean = bytecode => bytecode.replace(/a165627a7a72305820[0-9a-f]{64}0029$/i, '').toLowerCase();
    const deployed = clean(this.contractBytecode);
    const compiled = clean(this.contractSolc.evm.deployedBytecode.object);
    this.compareBytecode = { addr: deployed, cont: compiled };
    if (!compiled || compiled !== deployed) throw new Error('Contract runtime bytecode does not match.');
  }
}

exports.SolValidator = SolValidator;
