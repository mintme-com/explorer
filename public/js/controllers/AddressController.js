angular.module('BlocksApp').controller('AddressController', function($stateParams, $rootScope, $scope, $http, $location) {
    var activeTab = $location.url().split('#');
    if (activeTab.length > 1)
      $scope.activeTab = activeTab[1];

    $rootScope.$state.current.data["pageSubTitle"] = $stateParams.hash;
    $scope.addrHash = $stateParams.hash;
    $scope.addr = {"balance": 0, "count": 0, "mined": 0};
    $scope.settings = $rootScope.setup;

    //fetch web3 stuff
    $http({
      method: 'POST',
      url: '/web3relay',
      data: {"addr": $scope.addrHash, "options": ["balance", "count", "bytecode"]}
    }).then(function(resp) {
      $scope.addr = $.extend($scope.addr, resp.data);
      fetchTxs();
      if (resp.data.isContract) {
        $rootScope.$state.current.data["pageTitle"] = "Contract Address";
        fetchInternalTxs();
      }
    });

    //fetch transactions
    var fetchTxs = function() {
      var table = $("#table_txs").DataTable({
        processing: true,
        serverSide: true,
        paging: true,
        ajax: function(data, callback, settings) {
            data.addr = $scope.addrHash;
            data.count = $scope.addr.count;
            $http.post('/addr', data).then(function(resp) {
            $('label input').on('keyup', function () {
                resp.data.keyword = $('label').find('input').val();
            });
            var $Search = $('label').find('input').val() || null;
            var structDataFiltered = {
                draw: 0,
                recordsFiltered: 0,
                recordsTotal: 0,
                mined: 0,
                data: [[],[],[],[],[],[],[],[],[],[]]
            };
            var vClearItemFlag = 0;
            var vDeleteBlockAndDateFlag = 0;
            var vReturn = 0;
            var vItemIndex = 0;
            var vColumn = 0;
            var vDataLength = 0;
            var strReturn = new String;
            vClearItemFlag = 0;
            structDataFiltered.draw = resp.data.draw;
            structDataFiltered.recordsFiltered = resp.data.recordsFiltered;
            structDataFiltered.recordsTotal = resp.data.recordsTotal;
            structDataFiltered.mined = resp.data.mined;
            structDataFiltered.data = resp.data.data;
            vDataLength = structDataFiltered.data.length;
            if ($Search !== null) {
                for (vItemIndex = 0; vItemIndex < vDataLength; vItemIndex++) {
                    vDeleteBlockAndDateFlag = 0;
                    var vArrayItem = [];
                    vArrayItem = structDataFiltered.data[vItemIndex];
                    for (vColumn = 0; vColumn < vArrayItem.length; vColumn++) {
                        switch (vColumn) {
                        case 1:
                            strReturn = vArrayItem[vColumn].toString();
                            if (strReturn.indexOf($Search) > -1) {
                                vClearItemFlag++;
                            }
                            else {
                                vDeleteBlockAndDateFlag++;
                            }
                            break;
                        case 6:
                            strReturn = getDuration(vArrayItem[vColumn]).toString();
                            if (strReturn.indexOf($Search) > -1) {
                                vClearItemFlag++;
                            }
                            else {
                                vDeleteBlockAndDateFlag++;
                            }    
                            break;
                        }
                    }
                    if (vDeleteBlockAndDateFlag === 2) {
                        structDataFiltered.data.splice(vItemIndex,1);
                        vDataLength = structDataFiltered.data.length;
                        vItemIndex = -1;
                    }
                }
            }
            if (vClearItemFlag === 0 && $Search !== null) {
                structDataFiltered.data = [];
            }
            // save data
            //$scope.data = resp.data;
            $scope.data = structDataFiltered;
            // check $scope.records* if available.
            //resp.data.recordsTotal = $scope.recordsTotal ? $scope.recordsTotal : resp.data.recordsTotal;
            //resp.data.recordsFiltered = $scope.recordsFiltered ? $scope.recordsFiltered : resp.data.recordsFiltered;
            //callback(resp.data);
            resp.data.recordsTotal = $scope.recordsTotal ? $scope.recordsTotal : structDataFiltered.recordsTotal;
            resp.data.recordsFiltered = $scope.recordsFiltered ? $scope.recordsFiltered : structDataFiltered.recordsFiltered;
            callback(structDataFiltered);
          });

          // get mined, recordsTotal counter only once.
          if (data.draw > 1)
            return;

          $http.post('/addr_count', data).then(function(resp) {
            $scope.addr.count = resp.data.recordsTotal;
            $scope.addr.mined = parseInt(resp.data.mined);

            data.count = resp.data.recordsTotal;

            // set $scope.records*
            $scope.recordsTotal = resp.data.recordsTotal;
            $scope.recordsFiltered = resp.data.recordsFiltered;
            // draw table if $scope.data available.
            if ($scope.data) {
              $scope.data.recordsTotal = resp.data.recordsTotal;
              $scope.data.recordsFiltered = resp.data.recordsFiltered;
              callback($scope.data);
            }
          });
        },
        "lengthMenu": [
                    [10, 20, 50, 100, 150, 500],
                    [10, 20, 50, 100, 150, 500] // change per page values here
                ],
        "pageLength": 20,
        "order": [
            [6, "desc"]
        ],
        "language": {
          "lengthMenu": "_MENU_ transactions",
          "zeroRecords": "No transactions found",
          "infoEmpty": "",
          "infoFiltered": "(filtered from _MAX_ total txs)"
        },
        "columnDefs": [
          { "targets": [ 5 ], "visible": false, "searchable": false },
          {"type": "date", "targets": 6},
          {"orderable": false, "targets": [0,2,3,4]},
          { "render": function(data, type, row) {
                        if (data != $scope.addrHash)
                          return '<a href="/addr/'+data+'">'+data+'</a>'
                        else
                          return data
                      }, "targets": [2,3]},
          { "render": function(data, type, row) {
                        return '<a href="/block/'+data+'">'+data+'</a>'
                      }, "targets": [1]},
          { "render": function(data, type, row) {
                        return '<a href="/tx/'+data+'">'+data+'</a>'
                      }, "targets": [0]},
          { "render": function(data, type, row) {
                        return getDuration(data).toString();
                      }, "targets": [6]},
          ]
      });
    }

    var fetchInternalTxs = function() {
      $http({
        method: 'POST',
        url: '/web3relay',
        data: {"addr_trace": $scope.addrHash}
      }).then(function(resp) {
        $scope.internal_transactions = resp.data;
      });
    }

})
.directive('contractSource', function($http) {
  return {
    restrict: 'E',
    templateUrl: '/views/contract-source.html',
    scope: false,
    link: function(scope, elem, attrs){
        //fetch contract stuff
        $http({
          method: 'POST',
          url: '/compile',
          data: {"addr": scope.addrHash, "action": "find"}
        }).then(function(resp) {
          console.log(resp.data);
          scope.contract = resp.data;
        });
      }
  }
})
