'use strict';

angular.module('Pear2Pear')
  .factory('ProjectsSvc', ['swellRT', '$q', '$timeout', 'base64', 'SessionSvc', 'SwellRTCommon', 'ProfilesSvc', function(swellRT, $q, $timeout, base64, SessionSvc, SwellRTCommon, ProfilesSvc){

    var Project = function(){};

    Project.prototype.addContributor = function(user) {
      if (!user){
        user = SessionSvc.users.current();
      }
      if (user && this.contributors.indexOf(user) < 0){
        this.contributors.push(user);
      }
    };

    Project.prototype.setShareMode = function(shareMode){
      this.shareMode = shareMode;
    };

    //TODO profiles Service and bring this method there
    Project.prototype.timestampProjectAccess = function(){
      var proj = this;
      ProfilesSvc.current().then(function(profile) {
        profile.lastProjectVisit[proj.id] = (new Date()).toJSON();
      });
    };

    Project.prototype.toggleSupport = function(){
      if (SessionSvc.users.current() === null) {
        return;
      }
      var index = this.supporters.indexOf(SessionSvc.users.current());

      if (index > -1) {
        this.supporters.splice(index, 1);
      } else {
        this.supporters.push(SessionSvc.users.current());
      }
    };

    Project.prototype.removeContributor = function(user) {
      if (!user){
        user = SessionSvc.users.current();
      }

      this.contributors.splice(
        this.contributors.indexOf(user),
        1);
    };

    Project.prototype.toggleContributor = function(){
      if (SessionSvc.users.current() === null) {
        return;
      }
      var index = this.contributors.indexOf(SessionSvc.users.current());

      var user = SessionSvc.users.current();

      if (this.isContributor(user)) {
        this.removeContributor(user);
      } else {
        this.addContributor(user);
      }
    };

    Project.prototype.addChatMessage = function(message){
      this.chat.push({
          text: message,
          who: SessionSvc.users.current(),
          time: (new Date()).toJSON()
        });
      this.addContributor();
    };

    Project.prototype.addNeedComment = function(need, comment){
      if (!need.comments){
        need.comments = [];
      }
      need.comments.push({
        text: comment,
        time: (new Date()).toJSON(),
        author: SessionSvc.users.current()
      });
    };

    Project.prototype.isSupporter = function(user){
      if (!user){
        user = SessionSvc.users.current();
      }
      return this.supporters.indexOf(user) > -1;
    };

    Project.prototype.isContributor = function(user){
      if (!user){
        user = SessionSvc.users.current();
      }
      return this.contributors.indexOf(user) > -1;
    };

    // Service functions //

    var openedProjects = {};

    var find = function(urlId) {

      var id = base64.urldecode(urlId);
      var def = $q.defer();
      if (!openedProjects[id]) {
        openedProjects[id] = def.promise;
        SwellRT.openModel(id, function(model){
          $timeout(function(){
            var pr = swellRT.proxy(model, Project);
            def.resolve(pr);
          });
        }, function(error){
          console.log(error);
          def.reject(error);
        });
      }
      return openedProjects[id];
    };

    var create = function(callback, communityId) {
      var d = $q.defer();
      var id = SwellRT.createModel(function(model){
        openedProjects[id] = d.promise;

        SwellRTCommon.makeModelPublic(model);

        var proxyProj;

        $timeout(function(){
          proxyProj = swellRT.proxy(model, Project);
        });

        $timeout(function(){
          proxyProj.type = 'project';
          proxyProj.communities = (communityId) ? [communityId] : [];
          proxyProj.id = id;
          proxyProj.title = '';
          proxyProj.chat = [];
          proxyProj.pad = new swellRT.TextObject();
          proxyProj.needs = [];
          proxyProj.promoter = SessionSvc.users.current();
          proxyProj.supporters = [];
          proxyProj.contributors = [SessionSvc.users.current()];
          proxyProj.shareMode = 'public';
          d.resolve(proxyProj);
        });
      });

      d.promise.then(callback);

      return d.promise;
    };

    return {
      find: find,
      create: create
    };
  }]);
