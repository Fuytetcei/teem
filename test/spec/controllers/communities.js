'use strict';

describe('Controller: CommunitiesCtrl', function () {

  // load the controller's module
  beforeEach(module('Teem'));

  var CommunitiesCtrl,
    scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($controller, $rootScope) {
    scope = $rootScope.$new();
    CommunitiesCtrl = $controller('CommunitiesCtrl', {
      $scope: scope
    });
  }));

});
