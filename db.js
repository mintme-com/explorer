const mongoose = require('mongoose');

const Block = new mongoose.Schema({
  'number': { type: Number, index: { unique: true } },
  'hash': String,
  'parentHash': String,
  'nonce': String,
  'sha3Uncles': String,
  'logsBloom': String,
  'transactionsRoot': String,
  'stateRoot': String,
  'receiptRoot': String,
  'miner': String,
  'difficulty': String,
  'totalDifficulty': String,
  'size': Number,
  'extraData': String,
  'gasLimit': Number,
  'gasUsed': Number,
  'timestamp': Number,
  'blockTime': Number,
  'uncles': [String],
});

const Account = new mongoose.Schema({
  'address': { type: String, index: { unique: true } },
  'balance': Number,
  'blockNumber': Number,
  'type': { type: Number, default: 0 }, // address: 0x0, contract: 0x1
});

const Contract = new mongoose.Schema({
  'address': { type: String, index: { unique: true } },
  'creationTransaction': String,
  'contractName': String,
  'compilerVersion': String,
  'optimization': Boolean,
  'sourceCode': String,
  'abi': String,
  'byteCode': String,
  'valid': { type: Boolean, default: false },
}, { collection: 'Contract' });

const Transaction = new mongoose.Schema({
  'hash': { type: String, index: { unique: true } },
  'nonce': Number,
  'blockHash': String,
  'blockNumber': Number,
  'transactionIndex': Number,
  'from': String,
  'to': String,
  'creates': String,
  'value': String,
  'gas': Number,
  'gasPrice': String,
  'timestamp': Number,
  'input': String,
}, { collection: 'Transaction' });

const BlockStat = new mongoose.Schema({
  'number': { type: Number, index: { unique: true } },
  'timestamp': Number,
  'difficulty': String,
  'hashrate': String,
  'txCount': Number,
  'gasUsed': Number,
  'gasLimit': Number,
  'miner': String,
  'blockTime': Number,
  'uncleCount': Number,
});

const Market = new mongoose.Schema({
  'symbol': String,
  'timestamp': Number,
  'quoteBTC': Number,
  'quoteUSD': Number,
}, { collection: 'Market' });

// create indices
Transaction.index({ blockNumber: -1 });
Transaction.index({ from: 1, blockNumber: -1 });
Transaction.index({ to: 1, blockNumber: -1 });
Transaction.index({ creates: 1, blockNumber: -1 });
Account.index({ balance: -1 });
Account.index({ balance: -1, blockNumber: -1 });
Account.index({ type: -1, balance: -1 });
Block.index({ miner: 1 });
Block.index({ miner: 1, blockNumber: -1 });
Market.index({ timestamp: -1 });

mongoose.model('BlockStat', BlockStat);
mongoose.model('Block', Block);
mongoose.model('Account', Account);
mongoose.model('Contract', Contract);
mongoose.model('Transaction', Transaction);
mongoose.model('Market', Market);
module.exports.BlockStat = mongoose.model('BlockStat');
module.exports.Block = mongoose.model('Block');
module.exports.Contract = mongoose.model('Contract');
module.exports.Transaction = mongoose.model('Transaction');
module.exports.Account = mongoose.model('Account');
module.exports.Market = mongoose.model('Market');

mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost/blockDB', {
  useMongoClient: true,
});

// mongoose.set('debug', true);
