/*
  Tool for breaking out transactions

  DEPRECATED: DO NOT USE
*/

var mongoose = require( 'mongoose' );
require( '../db.js' );
var async = require('async');
var Block     = mongoose.model( 'Block' );
var Transaction     = mongoose.model( 'Transaction' );

var getTx = function() {
  mongoose.connection.on("open", function(err,conn) { 

    Block.find({}, "transactions timestamp").lean(true).then(function(docs) {
        async.forEach(docs, function(doc, cb) {
            var bulkOps = [];
          if (doc.transactions.length > 0) {
            for (d in doc.transactions) {
                var txData = doc.transactions[d];
                txData.timestamp = doc.timestamp;
                bulkOps.push(txData);
            }
              Transaction.collection.insertMany(bulkOps).then(function( tx ){
                console.log('DB successfully written for block ' +
                    tx.insertedCount.toString() );
                bulkOps = [];
                cb();
              }).catch(function( err ){
                if (err.code == 11000) {
                    console.log('Skip: Duplicate key ' + 
                    err);
                } else {
                   console.log('Error: Aborted due to error: ' + 
                        err);
                   process.exit(9);
               }
                bulkOps = [];
                cb();
              });
        
          }
    }, function() { return; });
      });  
  })
}

getTx()