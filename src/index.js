import express from "express";
import { ApolloServer, gql } from "apollo-server-express";
import http from "http";
import models, { sequelize } from "./models";

const app = express();

// TODO: sharedWith array return. it shouldn't return ID but users instead
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

  type Expense {
    id: ID!
    item: String
    value: Float
    sharedWith: [Int]
    currency: String
  }

  type Mutation {
    createUser(name: String!): User
    setFlightTicketPurchaseStatus(id: ID!, action: Boolean!): User
    addExpense(
      item: String!
      value: Float!
      sharedWith: [Int]
      currency: String
    ): Expense
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
    },
    addExpense: async (
      parent,
      { item, value, sharedWith, currency },
      { models }
    ) => {
      const expense = await models.Expense.create({
        item,
        value,
        sharedWith,
        currency
      });
      return expense;
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
