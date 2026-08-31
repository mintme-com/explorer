#!/usr/bin/env node
/**
 * Endpoint for richlist
 */

const mongoose = require('mongoose');

require('../db.js');

const Account = mongoose.model('Account');

var getAccounts = async function (req, res) {
  const self = getAccounts;
  if (!self.totalSupply) {
    self.totalSupply = -1;
    self.timestamp = 0;
  }

  // check cached totalSupply
  if (new Date() - self.timestamp > 30 * 60 * 1000) {
    self.totalSupply = -1;
    self.timestamp = 0;
  }

  // count accounts only once
  let count = req.body.recordsTotal || 0;
  count = parseInt(count);
  if (count < 0) {
    count = 0;
  }

  // get totalSupply only once
  const queryTotalSupply = self.totalSupply || req.body.totalSupply || null;

  let totalSupply = queryTotalSupply > 0 ? queryTotalSupply : null;

  try {
    if (queryTotalSupply < 0) {
      const docs = await Account.aggregate([
        { $group: { _id: null, totalSupply: { $sum: '$balance' } } },
      ]);

      totalSupply = docs[0].totalSupply;
      // update cache
      self.timestamp = new Date();
      self.totalSupply = totalSupply;
    }

    if (!count) {
      // get the number of all accounts
      count = parseInt(await Account.countDocuments({}));
    }
  } catch (error) {
    console.error(`Richlist error: ${error}`);
    res.write(JSON.stringify({ 'error': true }));
    res.end();
    return;
  }

  // check sort order
  let sortOrder = { balance: -1 };
  if (req.body.order && req.body.order[0] && req.body.order[0].column) {
    // balance column
    if (req.body.order[0].column == 3) {
      if (req.body.order[0].dir == 'asc') {
        sortOrder = { balance: 1 };
      }
    }
    if (req.body.order[0].column == 2) {
      // sort by account type and balance
      if (req.body.order[0].dir == 'asc') {
        sortOrder = { type: -1, balance: -1 };
      }
    }
  }

  // set datatable params
  const limit = parseInt(req.body.length);
  const start = parseInt(req.body.start);

  const data = { draw: parseInt(req.body.draw), recordsFiltered: count, recordsTotal: count };
  if (totalSupply > 0) {
    data.totalSupply = totalSupply;
  }

  try {
    const accounts = await Account.find({}).lean(true).sort(sortOrder).skip(start)
      .limit(limit);

    data.data = accounts.map((account, i) => [i + 1 + start, account.address, account.type, account.balance, account.blockNumber]);
    res.write(JSON.stringify(data));
  } catch (err) {
    console.error(`Richlist error: ${err}`);
    res.write(JSON.stringify({ 'error': true }));
  }
  res.end();
};

module.exports = getAccounts;
