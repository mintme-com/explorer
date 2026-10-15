const Contract = require('./contracts');
const { SolValidator } = require('../tools/solvalidator');

function formatVerifiedContracts(compiledSols) {
  const verifiedContracts = [];
  Object.values(compiledSols.contracts).forEach((source) => {
    Object.entries(source).forEach(([name, contract]) => {
      verifiedContracts.push({
        'name': name,
        'abi': contract.abi,
        'bytecode': contract.evm.bytecode.object,
      });
    });
  });
  return verifiedContracts;
}

/**
 * TODO: add custom errors type suport
 */
async function validateSolc(req, res) {
  let validator;

  const data = {
    address: req.body.address,
    compilerVersion: req.body.version,
    optimization: req.body.optimization,
    contractName: req.body.name,
    sourceCode: req.body.code,
  };

  try {
    validator = new SolValidator(req.body);
    if (req.body.inputFormat === 'standard-json') {
      validator.addStandardJson(req.body.code);
    } else {
      validator.addSource(`${req.body.name}.sol`, req.body.code);
    }
    data.optimization = Boolean(validator.solSettings.optimizer && validator.solSettings.optimizer.enabled);
    await validator.validate();
    data.valid = true;
    data.abi = JSON.stringify(validator.contractSolc.abi);
    data.byteCode = validator.contractBytecode;
    await Contract.addContract(data);
  } catch (e) {
    console.error('[solc]: ', e.message);
    data.valid = false;
    data.error = e.message;
  } finally {
    if (validator && validator.compiledSols && validator.compiledSols.contracts) {
      data.verifiedContracts = formatVerifiedContracts(validator.compiledSols);
    }
    res.write(JSON.stringify(data));
    res.end();
  }
};

/*
  TODO: support other languages
*/
module.exports = function (req, res) {
  if (!('action' in req.body)) res.status(400).send();
  if (req.body.action === 'compile') {
    validateSolc(req, res);
  } else if (req.body.action === 'find') {
    Contract.findContract(req.body.addr, res);
  }
};
