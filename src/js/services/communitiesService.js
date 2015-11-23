'use strict';

angular.module('Pear2Pear')
  .factory('CommunitiesSvc', [
  'swellRT', '$q', '$timeout', 'base64', 'SwellRTSession', 'SwellRTCommon', 'ProjectsSvc',
  function(swellRT, $q, $timeout, base64, SwellRTSession, SwellRTCommon, ProjectsSvc){

    var Community = function(){};

    Community.prototype.getProjectsSnapshot = function(){
      var foundProjects = $q.defer();
      var comId = this.id;
      SwellRT.query(
        {
          'root.type': 'project',
          'root.communities': comId,
          'root.shareMode': 'public'
        },
        function(result){
          var projs = [];
          angular.forEach(result.result, function(val) {
            projs.push(val.root);
          });
          foundProjects.resolve(projs);
        },
        function(e){
          foundProjects.reject(e);
        }
      );
      return foundProjects.promise;
    };

    Community.prototype.getProjects = function(){
      var projsDef = $q.defer();
      this.getProjectsSnapshot().then(function(all){
        var promises = {};
        if (all.length > 0){
          angular.forEach(all, function(val){
            var projDef = $q.defer();
            promises[val.id] = projDef.promise;
            // TODO create ProjectsSvc
            ProjectsSvc.find(base64.urlencode(val.id)).then(function(model){
              $timeout(function(){
                projDef.resolve(model);
              });
            });
          });
          projsDef.resolve($q.all(promises));
        } else {
          projsDef.resolve([]);
        }
      });
      return projsDef.promise;
    };

    // return the collection of projects of current user in the community as snapshots
    Community.prototype.myProjects = function(){
      var myProjs = $q.defer();

      var query = {
        _aggregate: [
          {
            $match: {
              'root.type': 'project',
              'root.contributors': SwellRTSession.users.current()
            }
          }
        ]};

      var comId = this.id;
      if (comId){
        query._aggregate[0].$match['root.communities'] = comId;
      }

      SwellRT.query(
        query,
        function(result) {

          var res = [];

          angular.forEach(result.result, function(val){
            res.push(val.root);
          });

          myProjs.resolve(res);
        },
        function(error){
          myProjs.reject(error);
        });
      return myProjs.promise;
    };

    Community.prototype.myAndPublicProjects = function(){
      var projs = $q.defer();

      var query = {
        _aggregate: [
          {
            $match: {
              'root.type': 'project',
              $or: [
                { 'root.contributors': SwellRTSession.users.current() },
                { 'root.shareMode': 'public' }
              ]
            }
          }
        ]};

      var comId = this.id;
      if (comId){
        query._aggregate[0].$match['root.communities'] = comId;
      }

      SwellRT.query(
        query,
        function(result) {

          var res = [];

          angular.forEach(result.result, function(val){
            res.push(val.root);
          });

          projs.resolve(res);
        },
        function(error){
          projs.reject(error);
        });
      return projs.promise;
    };

    Community.prototype.isParticipant = function(user){
      // Migrating from participants === undefined
      if (this.participants === undefined) {
        this.participants = [];
      }

      if (!user){
        user = SwellRTSession.users.current();
      }
      return this.participants.indexOf(user) > -1;
    };

    Community.prototype.addParticipant = function(user) {
      if (!user){
        if (!SwellRTSession.users.loggedIn()) {
          return;
        }

        user = SwellRTSession.users.current();
      }

      if (this.isParticipant(user)) {
        return;
      }

      this.participants.push(user);
    };

    Community.prototype.removeParticipant = function(user) {
      if (!user){
        if (!SwellRTSession.users.loggedIn()) {
          return;
        }

        user = SwellRTSession.users.current();
      }

      if (! this.isParticipant(user)) {
        return;
      }

      this.participants.splice(
        this.participants.indexOf(user),
        1);
    };

    Community.prototype.toggleParticipant = function(user) {
      if (!user){
        if (!SwellRTSession.users.loggedIn()) {
          return;
        }

        user = SwellRTSession.users.current();
      }

      if (this.isParticipant(user)) {
        this.removeParticipant(user);
      } else {
        this.addParticipant(user);
      }
    };

    // Service functions

    var openedCommunities = {};

    var find = function(urlId) {

      var id = base64.urldecode(urlId);
      var comDef = $q.defer();
      var community = comDef.promise;

      if (!openedCommunities[id]) {
        openedCommunities[id] = community;

        SwellRT.openModel(id, function(model){

          $timeout(function(){
            var pr = swellRT.proxy(model, Community);

            comDef.resolve(pr);
          });

        }, function(error){

          console.log(error);

          comDef.reject(error);
        });
      } else {
        openedCommunities[id].then(
          function(r){
            comDef.resolve(r);
          });
      }

      return community;
    };

    var create = function(data, callback) {
      var d = $q.defer();
      var id = window.SwellRT.createModel(function(model){
        openedCommunities[id] = d.promise;
        SwellRTCommon.makeModelPublic(model);

        var p;

        $timeout(function(){
          p = swellRT.proxy(model, Community);
        });

        $timeout(function(){
          p.type = 'community';
          p.name = data.name;
          p.id = id;
          p.participants = [SwellRTSession.users.current()];
          p.projects = [];
          d.resolve(p);
        });
      });

      d.promise.then(callback);

      return d.promise;
    };

    var all = function() {

      var communities = $q.defer();
      var foundCommunities = $q.defer();
      var foundProjectNumbers = $q.defer();

      var queries = $q.all([
        foundCommunities.promise,
        foundProjectNumbers.promise
      ]);

      var comms = {};
      var nums = {};

      SwellRT.query(
        {
          'root.type': 'community'
        },
        function(result){
          angular.forEach(result.result, function(val) {
            comms[val.root.id] = val.root;
          });

          foundCommunities.resolve(comms);
        },
        function(e){
          foundCommunities.reject(e);
        }
      );

      SwellRT.query(
        {_aggregate:
         [{$match: {
           'root.type': 'project',
           'root.shareMode': 'public'
         }},
          {$unwind: '$root.communities'},
          {$group :
           {_id:'$root.communities',
            number: { $sum : 1 }
           }
          }]},
        function(result){
          nums = result.result;
          foundProjectNumbers.resolve(nums);
        },
        function(e){
          foundCommunities.reject(e);
        }
      );

      queries.then(function(){
        angular.forEach(nums, function(val){
          comms[val._id].numProjects = val.number;
        });

        communities.resolve(comms);
      });

      return communities.promise;
    };

    // The communities the user is participating in
    var participating = function() {
      if (!SwellRTSession.users.loggedIn()) {
        return [];
      }

      return $q(function(resolve, reject) {
        var query = {
          _aggregate: [
            {
              $match: {
                'root.type': 'community',
                'root.participants': SwellRTSession.users.current()
              }
            }
          ]};

        SwellRT.query(
          query,
          function(result) {

            var res = [];

            angular.forEach(result.result, function(val){
              res.push(val.root);
            });

            resolve(res);
          },
          function(error){
            reject(error);
          }
        );
      });
    };

    var setCurrent = function(communityId) {
      return window.localStorage.setItem('communityId', communityId);
    };

    var current = function() {
      return window.localStorage.getItem('communityId');
    };

    return {
      find : find,
      create: create,
      all: all,
      participating: participating,
      setCurrent: setCurrent,
      current: current
    };
  }]);
