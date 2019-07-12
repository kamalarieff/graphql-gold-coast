import express from "express";
import { ApolloServer, gql } from "apollo-server-express";
import http from "http";
import models, { sequelize } from "./models";

const app = express();

const schema = gql`
  type Query {
    users: [User!]
    user(name: String!): User
  }

  type User {
    id: ID!
    name: String!
    purchaseFlightTicket: Boolean
  }

  type Mutation {
    createUser(name: String!): User
    setFlightTicketPurchaseStatus(id: ID!, action: Boolean!): User
  }
`;

const resolvers = {
  Query: {
    users: async (parent, args, { models }) => {
      return await models.User.findAll();
    }
  },
  Mutation: {
    createUser: async (parent, { name }, { models }) => {
      const user = await models.User.create({
        name,
        purchaseFlightTicket: false
      });
      return user;
    },
    setFlightTicketPurchaseStatus: async (
      parent,
      { id, action },
      { models }
    ) => {
      const user = await models.User.update(
        { purchaseFlightTicket: action },
        {
          where: {
            id
          },
          returning: true
        }
      );
      const [_, [updatedValues]] = user;
      return updatedValues;
    }
  }
};

const server = new ApolloServer({
  typeDefs: schema,
  resolvers,
  context: async () => {
    return { models };
  }
});

server.applyMiddleware({ app, path: "/graphql" });

const httpServer = http.createServer(app);

const port = process.env.PORT || 8000;

sequelize.sync().then(async () => {
  httpServer.listen({ port }, () => {
    console.log("Apollo Server on http://localhost:8000/graphql");
  });
});
