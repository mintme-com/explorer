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
  const validator = new SolValidator(req.body)
    .addSource(`${req.body.name}.sol`, req.body.code);
  const data = {};
  try {
    await validator.validate();
    data.valid = true;
    data.abi = validator.contractSolc.abi;
    data.byteCode = validator.contractBytecode;
    Contract.addContract(data);
  } catch (e) {
    console.log('[solc]: ', { input: validator.solcInput, output: validator.compiledSols, comparedBytecode: validator.compareBytecode });
    data.valid = false;
  } finally {
    if (validator.compiledSols && validator.compiledSols.contracts) {
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
