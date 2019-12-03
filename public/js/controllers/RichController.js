angular.module('BlocksApp').controller('RichController', function($stateParams, $rootScope, $scope, $http, $location) {
    $scope.$on('$viewContentLoaded', function() {
        // initialize core components
        App.initAjax();
    });

    if(!dataSet[0][0].startsWith('<')) {
        for(var i=0; i<dataSet.length; i++) {
            dataSet[i][0] = '<a href="addr/' + dataSet[i][0] + '">' + dataSet[i][0] + '</a>';
        }
    }

    const dataTable = $('#table_txs').DataTable({
          data: dataSet,
          "order": [[ 1, "desc" ]],
          columns: [
            { title: 'Address' },
            { title: 'Amount' }
          ]
        });
})
