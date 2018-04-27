angular.module('BlocksApp').controller('StatsController', function($stateParams, $rootScope, $scope) {

    $rootScope.isHome = false;
    $scope.settings = $rootScope.setup;

    /*
      Chart types:
        etc_hashrate: WEB Hashrate Growth
        miner_hashrate: Miner Hashrate Distribution
    */

    const CHART_TYPES = {
        "etc_hashrate": {
            "title": "WEB Hashrate Growth"
        },
        "miner_hashrate": {
            "title": "Miner Hashrate Distribution"
        },
        "The_bomb_chart": {
            "title": "The bomb chart"
        }
    }

    $rootScope.$state.current.data["pageSubTitle"] = CHART_TYPES[$stateParams.chart].title;

})
