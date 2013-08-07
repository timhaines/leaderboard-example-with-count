// Set up a collection to contain player information. On the server,
// it is backed by a MongoDB collection named "players".

Players = new Meteor.Collection("players");
Counts = new Meteor.Collection("counts");

if (Meteor.isClient) {
  Template.leaderboard.players = function () {
    return Players.find({}, {sort: {score: -1, name: 1}});
  };

  Template.leaderboard.selected_name = function () {
    var player = Players.findOne(Session.get("selected_player"));
    return player && player.name;
  };

  Template.player.selected = function () {
    return Session.equals("selected_player", this._id) ? "selected" : '';
  };

  Template.leaderboard.events({
    'click input.inc': function () {
      Players.update(Session.get("selected_player"), {$inc: {score: 5}});
    }
  });

  Template.player.events({
    'click': function () {
      Session.set("selected_player", this._id);
    }
  });
}

// On server startup, create some players if the database is empty.
if (Meteor.isServer) {
  Meteor.startup(function () {
    if (Players.find().count() === 0) {
      var names = ["Ada Lovelace",
                   "Grace Hopper",
                   "Marie Curie",
                   "Carl Friedrich Gauss",
                   "Nikola Tesla",
                   "Claude Shannon"];
      for (var i = 0; i < names.length; i++)
        Players.insert({name: names[i], score: Math.floor(Random.fraction()*10)*5});
    }
  });

  Meteor.publish('players', function() {
    return Players.find();
  });

  Meteor.publish("counts", function () {
    var self = this;
    countId = 'demoCount';
    times = {a:0};
    var count = 0;
    var initializing = true;
    var handle = Players.find().observe({
      added: function (doc) {
        count += doc.score;
        if (!initializing)
          self.changed("counts", countId, {count: count, times: times});
      },
      changed: function (doc, oldDoc) {
        count += doc.score - oldDoc.score;
        times.a += 1;
        timesDup = _.clone(times);
        // Even though times is being increased, calling changed with it isn't
        // incrementing the value sent to the client.
        // This is because the "old value" retrieved by Meteor's changeField is the same instance of times
        self.changed("counts", countId, {count: count, times: times, timesDup: timesDup});
        console.log('times on the server is now', times, 'but the client doesn\'t know')
      },
      removed: function (doc) {
        count -= doc.score;
        self.changed("counts", countId, {count: count, times: times});
      }
      // don't care about moved or changed
    });

    // Observe only returns after the initial added callbacks have
    // run.  Now return an initial value and mark the subscription
    // as ready.
    initializing = false;
    timesDup = _.clone(times);
    self.added("counts", countId, {count: count, times:times, timesDup:timesDup });
    self.ready();

    // Stop observing the cursor when client unsubs.
    // Stopping a subscription automatically takes
    // care of sending the client any removed messages.
    self.onStop(function () {
      handle.stop();
    });
  });
}

if (Meteor.isClient) {
  Meteor.startup(function () {
    Meteor.subscribe('counts');
    Meteor.subscribe('players');
  });

  Counts.find().observe({
    added: function(doc) {console.log('added', doc)},
    changed: function(doc, oldDoc) {console.log('changed, new times value is', doc.times, 'and dup is', doc.timesDup)}
  });
}
