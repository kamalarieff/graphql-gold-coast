import express from "express";
import { ApolloServer, gql } from "apollo-server-express";
import http from "http";
import models, { sequelize } from "./models";
import jwt from "jsonwebtoken";
import { ForbiddenError, UserInputError } from "apollo-server";
import { skip, combineResolvers } from "graphql-resolvers";
import { GraphQLDate, GraphQLTime, GraphQLDateTime } from "graphql-iso-date";

export const isAuthenticated = (parent, args, { me }) =>
  me ? skip : new ForbiddenError("Not authenticated as user.");

const createToken = async user => {
  const { id, username } = user;
  return await jwt.sign({ id, username }, "secret");
};

const app = express();

// TODO: sharedWith array return. it shouldn't return ID but users instead
const schema = gql`
  scalar Date
  scalar Time
  scalar DateTime

  type Query {
    users: [User!]
    user(username: String!): User
    expenses: [Expense!]
  }

  type User {
    id: ID!
    username: String!
    purchaseFlightTicket: Boolean
  }

  type Expense {
    id: ID!
    item: String
    value: Float
    sharedWith: [Int]
    currency: String
    createdAt: DateTime
  }

  type Token {
    token: String!
  }

  type Mutation {
    createUser(username: String!): User
    setFlightTicketPurchaseStatus(action: Boolean!): User
    addExpense(
      item: String!
      value: Float!
      sharedWith: [Int]
      currency: String
    ): Expense
    signIn(username: String!): Token!
  }
`;

const resolvers = {
  Query: {
    users: async (parent, args, { models }) => {
      return await models.User.findAll();
    },
    expenses: async (parent, args, { models }) => {
      return await models.Expense.findAll();
    }
  },
  Mutation: {
    createUser: async (parent, { username }, { models }) => {
      const user = await models.User.create({
        username
      });
      return user;
    },
    setFlightTicketPurchaseStatus: async (
      parent,
      { action },
      { models, me }
    ) => {
      const user = await models.User.update(
        { purchaseFlightTicket: action },
        {
          where: {
            id: me.id
          },
          returning: true
        }
      );
      const [_, [updatedValues]] = user;
      return updatedValues;
    },
    addExpense: combineResolvers(
      isAuthenticated,
      async (parent, { item, value, sharedWith, currency }, { models, me }) => {
        const expense = await models.Expense.create({
          item,
          value,
          sharedWith,
          currency,
          userId: me.id
        });
        return expense;
      }
    ),
    signIn: async (parent, { username }, { models }) => {
      const user = await models.User.findOne({
        where: {
          username
        }
      });

      if (!user) {
        throw new UserInputError("No user found with this login credentials.");
      }

      return { token: createToken(user) };
    }
  },
  Date: GraphQLDate,
  Time: GraphQLTime,
  DateTime: GraphQLDateTime
};

const getMe = async req => {
  const token = req.headers["x-token"];

  if (token) {
    try {
      return await jwt.verify(token, "secret");
    } catch (e) {
      throw new AuthenticationError("Your session expired. Sign in again.");
    }
  }
};

const server = new ApolloServer({
  introspection: true,
  playground: true,
  typeDefs: schema,
  resolvers,
  context: async ({ req }) => {
    const me = await getMe(req);
    return { models, me };
  }
});

server.applyMiddleware({ app, path: "/graphql" });

const httpServer = http.createServer(app);

const port = process.env.PORT || 8000;

sequelize.sync().then(async () => {
  httpServer.listen({ port }, () => {
    console.log(`Apollo Server on http://localhost:${port}/graphql`);
  });
});
