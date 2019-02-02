const { ApolloServer, gql, PubSub } = require("apollo-server");
const fetch = require("node-fetch");
const lifts = require("./data/lifts.json");
const trails = require("./data/trails.json");

const pubsub = new PubSub();

const context = { lifts, trails, pubsub };

const typeDefs = gql`
    type Lift {
        id: ID!
        name: String!
        status: LiftStatus!
        capacity: Int!
        night: Boolean!
        elevationGain: Int!
        trailAccess: [Trail!]!
    }

    type Trail {
        id: ID!
        name: String!
        status: TrailStatus
        difficulty: String!
        groomed: Boolean!
        trees: Boolean!
        night: Boolean!
        accessedByLifts: [Lift!]!
    }

    # STEP 1. Add the type
    # I added an Activity Type based on the Strava fields that I 
    # want to use in this service
    type Activity {
      id: ID!
      name: String
      distance: Float
      type: String
      time: Int
    }

    enum LiftStatus {
        OPEN
        HOLD
        CLOSED
    }

    enum TrailStatus {
        OPEN
        CLOSED
    }

    type Query {
        allLifts(status: LiftStatus): [Lift!]!
        Lift(id: ID!): Lift!
        liftCount(status: LiftStatus!): Int!
        allTrails(status: TrailStatus): [Trail!]!
        Trail(id: ID!): Trail!
        trailCount(status: TrailStatus!): Int!

        # STEP 2. Add the Query
        # Add the myActivities query to provide a list of activities
        myActivities: [Activity!]!

    }

    type Mutation {
        setLiftStatus(id: ID!, status: LiftStatus!): Lift!
        setTrailStatus(id: ID!, status: TrailStatus!): Trail!
    }

    type Subscription {
        liftStatusChange: Lift
        trailStatusChange: Trail
    }
`;
const resolvers = {
  Query: {
    // # STEP 3. Add the Resolver
    myActivities: async () => {
      let results = await fetch(
        "https://www.strava.com/api/v3/activities?per_page=100",
        {
          headers: {
            Authorization: "Bearer <Your_Strava_Token_here>"
          }
        }
      ).then(r => r.json());

      return results;
    },

    allLifts: (root, { status }, { lifts }) => {
      if (!status) {
        return lifts;
      } else {
        let filteredLifts = lifts.filter(lift => lift.status === status);
        return filteredLifts;
      }
    },
    Lift: (parent, { id }, { lifts }) => lifts.find(lift => id === lift.id),
    liftCount: (parent, { status }, { lifts }) => {
      let i = 0;
      lifts.map(lift => {
        lift.status === status ? i++ : null;
      });
      return i;
    },
    allTrails: (root, { status }, { trails }) => {
      if (!status) {
        return trails;
      } else {
        let filteredTrails = trails.filter(trail => trail.status === status);
        return filteredTrails;
      }
    },
    Trail: (root, { id }, { trails }) => trails.find(trail => id === trail.id),
    trailCount: (root, { status }, { trails }) => {
      let i = 0;
      trails.map(trail => {
        trail.status === status ? i++ : null;
      });
      return i;
    }
  },
  Mutation: {
    setLiftStatus: (root, { id, status }, { lifts, pubsub }) => {
      let updatedLift = lifts.find(lift => id === lift.id);
      updatedLift.status = status;
      pubsub.publish("lift-status-change", { liftStatusChange: updatedLift });
      return updatedLift;
    },
    setTrailStatus: (root, { id, status }, { trails, pubsub }) => {
      let updatedTrail = trails.find(trail => id === trail.id);
      updatedTrail.status = status;
      pubsub.publish("trail-status-change", {
        trailStatusChange: updatedTrail
      });
      return updatedTrail;
    }
  },
  Subscription: {
    liftStatusChange: {
      subscribe: (root, data, { pubsub }) =>
        pubsub.asyncIterator("lift-status-change")
    },
    trailStatusChange: {
      subscribe: (root, data, { pubsub }) =>
        pubsub.asyncIterator("trail-status-change")
    }
  },
  Lift: {
    trailAccess: (root, args, { trails }) =>
      root.trails.map(id => trails.find(t => id === t.id)).filter(x => x)
  },
  Trail: {
    accessedByLifts: (root, args, { lifts }) =>
      root.lift.map(id => lifts.find(l => id === l.id)).filter(x => x)
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context
});

server.listen().then(({ url }) => {
  console.log(`Server running at ${url}`);
});
