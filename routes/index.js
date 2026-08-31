const mongoose = require('mongoose');

const Block = mongoose.model('Block');
const Transaction = mongoose.model('Transaction');
const Account = mongoose.model('Account');
const filters = require('./filters');

module.exports = function (app) {
  const web3relay = require('./web3relay');

  const Token = require('./token');

  const compile = require('./compiler');
  const stats = require('./stats');
  const richList = require('./richlist');

  /*
    Local DB: data request format
    { "address": "0x1234blah", "txin": true }
    { "tx": "0x1234blah" }
    { "block": "1234" }
  */
  app.post('/richlist', richList);
  app.post('/addr', getAddr);
  app.post('/addr_count', getAddrCounter);
  app.post('/tx', getTx);
  app.post('/block', getBlock);
  app.post('/data', getData);
  app.get('/total', getTotal);

  app.post('/tokenrelay', Token);
  app.post('/web3relay', web3relay.data);
  app.post('/compile', compile);

  app.post('/stats', stats);
};

const getAddr = async (req, res) => {
  // TODO: validate addr and tx
  const addr = req.body.addr.toLowerCase();
  const count = parseInt(req.body.count);

  const limit = parseInt(req.body.length);
  const start = parseInt(req.body.start);

  const data = {
    draw: parseInt(req.body.draw), recordsFiltered: count, recordsTotal: count, mined: 0,
  };

  const addrFind = Transaction.find({ $or: [{ 'to': addr }, { 'from': addr }] });

  let sortOrder = '-blockNumber';
  if (req.body.order && req.body.order[0] && req.body.order[0].column) {
    // date or blockNumber column
    if (req.body.order[0].column == 1 || req.body.order[0].column == 6) {
      if (req.body.order[0].dir == 'asc') {
        sortOrder = 'blockNumber';
      }
    }
  }

  try {
    const docs = await addrFind.lean(true).sort(sortOrder).skip(start)
      .limit(limit);
    if (docs) data.data = filters.filterTX(docs, addr);
    else data.data = [];
  } catch (err) {
    console.error(`AddrFind error: ${err}`);
    data.data = [];
  }
  res.write(JSON.stringify(data));
  res.end();
};
var getAddrCounter = async function (req, res) {
  const addr = req.body.addr.toLowerCase();
  const count = parseInt(req.body.count);
  const data = { recordsFiltered: count, recordsTotal: count, mined: 0 };

  try {
    const txCount = await Transaction.countDocuments({ $or: [{ 'to': addr }, { 'from': addr }] });
    if (txCount) {
      // fix recordsTotal
      data.recordsTotal = txCount;
      data.recordsFiltered = txCount;
    }
  } catch (err) {
    console.error(`AddrCounter error: ${err}`);
  }

  try {
    const minedCount = await Block.countDocuments({ 'miner': addr });
    if (minedCount) {
      data.mined = minedCount;
    }
  } catch (err) {
    console.error(`AddrCounter error: ${err}`);
  }

  res.write(JSON.stringify(data));
  res.end();
};
var getBlock = async function (req, res) {
  // TODO: support queries for block hash
  const txQuery = 'number';
  const number = parseInt(req.body.block);

  try {
    const doc = await Block.findOne({ number }).lean(true);
    if (!doc) {
      console.error(`BlockFind error: block ${number} not found`);
      console.error(req.body);
      res.write(JSON.stringify({ 'error': true }));
    } else {
      const block = filters.filterBlocks([doc]);
      res.write(JSON.stringify(block[0]));
    }
  } catch (err) {
    console.error(`BlockFind error: ${err}`);
    console.error(req.body);
    res.write(JSON.stringify({ 'error': true }));
  }
  res.end();
};
var getTx = async function (req, res) {
  const tx = req.body.tx.toLowerCase();
  let doc = null;
  try {
    doc = await Block.findOne({ 'transactions.hash': tx }, 'transactions timestamp')
      .lean(true);
  } catch (err) {
    console.error(`TxFind error: ${err}`);
  }
  if (!doc) {
    console.log(`missing: ${tx}`);
    res.write(JSON.stringify({}));
    res.end();
  } else {
    // filter transactions
    const txDocs = filters.filterBlock(doc, 'hash', tx);
    res.write(JSON.stringify(txDocs));
    res.end();
  }
};
/*
  Fetch data from DB
*/
var getData = function (req, res) {
  // TODO: error handling for invalid calls
  const action = req.body.action.toLowerCase();
  const { limit } = req.body;

  if (action in DATA_ACTIONS) {
    if (isNaN(limit)) var lim = MAX_ENTRIES;
    else var lim = parseInt(limit);
    DATA_ACTIONS[action](lim, res);
  } else {
    console.error(`Invalid Request: ${action}`);
    res.status(400).send();
  }
};

/*
  Total supply API code
*/
var getTotal = async function (req, res) {
  try {
    const docs = await Account.aggregate([
      { $group: { _id: null, totalSupply: { $sum: '$balance' } } },
    ]);
    res.write(docs[0].totalSupply.toString());
  } catch (err) {
    console.error(`getTotal error: ${err}`);
    res.write('Error getting total supply');
  }
  res.end();
};

/*
  temporary blockstats here
*/
const latestBlock = async function (req, res) {
  let doc = null;
  try {
    doc = await Block.findOne({}, 'totalDifficulty')
      .lean(true).sort('-number');
  } catch (err) {
    console.error(`latestBlock error: ${err}`);
  }
  res.write(JSON.stringify(doc));
  res.end();
};

const getLatest = async function (lim, res, callback) {
  let docs = null;
  try {
    docs = await Block.find({}, 'number transactions timestamp miner extraData')
      .lean(true).sort('-number').limit(lim);
  } catch (err) {
    console.error(`getLatest error: ${err}`);
  }
  callback(docs, res);
};

/* get blocks from db */
const sendBlocks = async function (lim, res) {
  let docs = null;
  try {
    docs = await Block.find({}, 'number timestamp miner extraData')
      .lean(true).sort('-number').limit(lim);
  } catch (err) {
    console.log(`blockFind error:${err}`);
  }
  if (!docs || !docs.length) {
    res.write(JSON.stringify({ 'error': true }));
    res.end();
    return;
  }

  const blockNumber = docs[docs.length - 1].number;
  // aggregate transaction counters
  let results = null;
  try {
    results = await Transaction.aggregate([
      { $match: { blockNumber: { $gte: blockNumber } } },
      { $group: { _id: '$blockNumber', count: { $sum: 1 } } },
    ]);
  } catch (err) {
    console.log(`transaction aggregate error:${err}`);
  }
  const txns = {};
  if (results) {
    // set transaction counters
    results.forEach((txn) => {
      txns[txn._id] = txn.count;
    });
    docs.forEach((doc) => {
      doc.txn = txns[doc.number] || 0;
    });
  }
  res.write(JSON.stringify({ 'blocks': filters.filterBlocks(docs) }));
  res.end();
};

const sendTxs = async function (lim, res) {
  let txs = null;
  try {
    txs = await Transaction.find({}).lean(true).sort('-blockNumber').limit(lim);
  } catch (err) {
    console.error(`sendTxs error: ${err}`);
  }
  res.write(JSON.stringify({ 'txs': txs }));
  res.end();
};

const MAX_ENTRIES = 10;

const DATA_ACTIONS = {
  'latest_blocks': sendBlocks,
  'latest_txs': sendTxs,
};
