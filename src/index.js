import express from "express";
import { ApolloServer, gql } from "apollo-server-express";
import redis from "ioredis";

const client = new redis(process.env.REDIS_URL);

client.on("connect", () => {
  console.log("Redis connected");
});

const app = express();

const schema = gql`
  type Query {
    users: [User!]
    user(name: String!): User
  }

  type Mutation {
    createUser(name: String!): User!
    setPurchaseFlightTicket(name: String!): User!
  }

  type User {
    name: String!
    boughtFlightTicket: Boolean!
  }
`;

const convertToBoolean = value => {
  if (value == "false") return false;
  else if (value == "true") return true;
  return value;
};

const resolvers = {
  Query: {
    users: async () => {
      let finalRes = [];
      const keys = await client.keys("*");
      for (let value of keys) {
        let res = await client.hgetall(value);
        let temp = {};
        for (let [key, value] of Object.entries(res)) {
          value = convertToBoolean(value);
          temp = { ...temp, [key]: value };
        }
        finalRes.push(temp);
      }
      return finalRes;
    },
    user: async (parent, { username }) => {
      const res = await client.hgetall(username);
      let temp = {};
      for (let [key, value] of Object.entries(res)) {
        value = convertToBoolean(value);
        temp = { ...temp, [key]: value };
      }
      return temp;
    }
  },
  Mutation: {
    createUser: (parent, { name }) => {
      client.hset(name, "name", name);
      client.hset(name, "boughtFlightTicket", false);
      return {
        name,
        boughtFlightTicket: false
      };
    },
    setPurchaseFlightTicket: (parent, { name }) => {
      client.hset(name, "boughtFlightTicket", true);
      return {
        name,
        boughtFlightTicket: true
      };
    }
  }
};

const server = new ApolloServer({
  typeDefs: schema,
  resolvers
});

server.applyMiddleware({ app, path: "/graphql" });

app.listen({ port: 8000 }, () => {
  console.log("Apollo Server on http://localhost:8000/graphql");
});
