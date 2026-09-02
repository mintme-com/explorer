/*
  Stuff to deal with verified contracts in DB
*/

require('../db.js');
const mongoose = require('mongoose');

const Contract = mongoose.model('Contract');

exports.addContract = async function (contract) {
  try {
    const data = await Contract.updateOne(
      { address: contract.address },
      { $setOnInsert: contract },
      { upsert: true },
    );
    console.log(data);
  } catch (err) {
    console.error(`AddContract error: ${err}`);
  }
};

exports.findContract = async function (address, res) {
  try {
    const doc = await Contract.findOne({ address }).lean(true);
    if (!doc || !doc.sourceCode) {
      res.write(JSON.stringify({ 'valid': false }));
    } else {
      const data = doc;
      res.write(JSON.stringify(data));
    }
  } catch (err) {
    console.error(`ContractFind error: ${err}`);
    console.error(`bad address: ${address}`);
    res.write(JSON.stringify({ 'error': true, 'valid': false }));
  }
  res.end();
};
