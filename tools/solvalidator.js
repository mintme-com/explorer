
const solc = require('solc');
const { eth } = require('../routes/web3relay');

class SolValidator {
  static checkSolcSnapshot(err, solcSnapshot) {
    if (err) throw new Error(err);
    return solcSnapshot;
  }

  constructor(configs) {
    this.contractAddress = configs.address;
    this.contractName = configs.name;
    this.contracSource = `${this.contractName}.sol`;
    this.contractBytecode = null;
    this.contractSolc = null;
    this.solVersion = configs.version;
    this.solOptimizer = configs.optimization;
    this.solSources = configs.sources || {};
    this.solSettings = configs.settings || {
      outputSelection: {
        '*': {
          '*': ['*'],
        },
      },
    };
    this.compiledSols = null;
  }

  /**
   * @property {bool} define if solc compiler use obtimizer
   */
  set solcOptimizer(active) {
    if (active) {
      this.addSetting('optimizer', {
        enabled: true,
        runs: 200,
      });
    };
  }

  get solcInput() {
    return {
      language: 'Solidity',
      sources: this.solSources,
      settings: this.solSettings,
    };
  }

  addSource(name, content) {
    this.solSources[name] = { content };
    return this;
  }

  addSetting(newSetting) {
    this.solSettings = { ...this.solcSettings, ...newSetting };
    return this;
  }

  /**
   * TODO: handle eth errors;
   */

  setByteCode() {
    return new Promise(async (resolve) => {
      this.contractBytecode = await eth.getCode(this.contractAddress);
      if (this.contractBytecode.substring(0, 2) === '0x') this.contractBytecode = this.contractBytecode.substring(2);
      resolve();
    });
  }

  async validate() {
    try {
      await this.setByteCode();
      await this.compileSources();
      this.validateSolcOutput();
      this.compareSources();
      return this;
    } catch (e) {
      throw e;
    }
  }

  async getSolcSnapshot(version = this.solVersion) {
    return new Promise((resolve) => {
      solc.loadRemoteVersion(version, (err, solcSnapshot) => resolve(this.constructor.checkSolcSnapshot(err, solcSnapshot)));
    });
  }

  async compileSources(solcSnapshot = solc) {
    let loadSolc = solcSnapshot;
    if (this.solcVersion !== solcSnapshot.version()) {
      loadSolc = await this.getSolcSnapshot();
    }
    this.compiledSols = JSON.parse(loadSolc.compile(JSON.stringify(this.solcInput)));
  }

  validateSolcOutput() {
    if (!this.compiledSols.contracts) {
      throw new Error('the sol file could not be compiled.');
    } else if (!this.compiledSols.contracts[this.contracSource][this.contractName]) {
      throw new Error('the name of the contract is not present in the sol file.');
    } else {
      this.contractSolc = this.compiledSols.contracts[this.contracSource][this.contractName];
    }
  }

  compareSources() {
    const bytecodeClean = this.contractBytecode.replace(/a165627a7a72305820.{64}0029$/gi, '');
    const contractBytecode = this.contractSolc.evm.bytecode.object;
    let contractBytecodeClean = contractBytecode.replace(/a165627a7a72305820.{64}0029$/gi, '');
    const constructorArgs = contractBytecodeClean.replace(bytecodeClean, '');
    contractBytecodeClean = contractBytecodeClean.replace(constructorArgs, '');

    if (contractBytecodeClean !== bytecodeClean) {
      throw new Error('contract validation failed');
    }
  }
};

exports.SolValidator = SolValidator;
