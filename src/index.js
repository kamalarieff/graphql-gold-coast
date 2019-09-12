import express from "express";
import { ApolloServer, gql } from "apollo-server-express";
import http from "http";
import models, { sequelize } from "./models";
import jwt from "jsonwebtoken";
import { ForbiddenError, UserInputError, ApolloError } from "apollo-server";
import { skip, combineResolvers } from "graphql-resolvers";
import { GraphQLDate, GraphQLTime, GraphQLDateTime } from "graphql-iso-date";
import GraphQLJSON from "graphql-type-json";
import Sequelize from "sequelize";
import * as R from "ramda";

const Op = Sequelize.Op;

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
  scalar JSON

  type Query {
    users: [User!]
    user(username: String!): User
    expenses: [Expense!]
    todos: [Todo!]
    userTodos: [UserTodo!]
    myTodos: [UserTodo]
  }

  type User {
    id: ID!
    username: String!
    purchaseFlightTicket: Boolean
    token: String
  }

  type Expense {
    id: ID!
    item: String
    value: Float
    sharedWith: [User]
    currency: String
    createdAt: DateTime
    updatedAt: DateTime
    user: User
  }

  type Token {
    token: String!
  }

  type Todo {
    id: ID!
    item: String!
    additionalDetails: JSON
  }

  type UserTodo {
    id: ID!
    status: String
    todo: Todo
    user: User
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
    updateExpense(
      id: ID!
      item: String!
      value: Float!
      sharedWith: [Int]
      currency: String
    ): Expense
    deleteExpense(id: ID!): Boolean
    signIn(username: String!): User
    addTodo(item: String!, additional_details: JSON): Todo
    assignTodo(todoId: Int!, userId: [Int!]): [UserTodo]
    updateTodoStatus(status: TodoStatusEnum!, todoId: Int!): UserTodo
  }

  enum TodoStatusEnum {
    IN_PROGRESS
    DONE
  }
`;

const resolvers = {
  Query: {
    users: async (parent, args, { models }) => {
      return await models.User.findAll();
    },
    expenses: async (parent, args, { models }) => {
      return await models.Expense.findAll({
        include: [
          {
            model: models.User,
            required: true
          }
        ]
      });
    },
    todos: async (parent, args, { models }) => {
      return await models.Todo.findAll();
    },
    userTodos: async (parent, args, { models }) => {
      return await models.UserTodo.findAll({
        include: [
          {
            model: models.Todo,
            required: true
          },
          {
            model: models.User,
            required: true
          }
        ]
      });
    },
    myTodos: async (parent, args, { models, me }) => {
      try {
        return await models.UserTodo.findAll({
          include: [
            {
              model: models.Todo,
              required: true
            }
          ],
          where: {
            userId: me.id
          }
        });
      } catch (e) {
        console.log("e", e);
      }
    }
  },
  User: {
    token: user => {
      return createToken(user);
    }
  },
  Expense: {
    sharedWith: async (expense, _, { models }) => {
      try {
        return await models.User.findAll({
          where: {
            id: {
              [Op.in]: expense.sharedWith
            }
          }
        });
      } catch (e) {
        return [];
      }
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
    updateExpense: combineResolvers(
      isAuthenticated,
      async (parent, { id, item, value, sharedWith, currency }, { models }) => {
        try {
          const [_, expense] = await models.Expense.update(
            {
              item,
              value,
              sharedWith,
              currency
            },
            {
              where: {
                id: id
              },
              returning: true
            }
          );
          // there will only be one expense because of the where predicate
          return expense[0];
        } catch (e) {
          console.log("e", e);
        }
      }
    ),
    deleteExpense: combineResolvers(
      isAuthenticated,
      async (parent, { id }, { models }) => {
        const res = await models.Expense.destroy({
          where: {
            id: id
          }
        });
        console.log("res", res);
        if (res === 0) throw new ApolloError("No expense found.", 200);
        // there will only be one expense because of the where predicate
        return true;
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

      return user;
    },
    addTodo: async (parent, { item, additional_details }, { me, models }) => {
      const todo = await models.Todo.create({
        item,
        additional_details
      });

      return todo;

      const { id } = todo;
      // console.log("TCL: todo", todo);
      console.log("TCL: id", id);
      await models.UserTodo.create({
        status: "In Progress",
        userId: me.id,
        todoId: id
      });

      return todo;
    },
    assignTodo: async (parent, { todoId, userId }, { models }) => {
      const temp = R.map(user => ({
        status: "In Progress",
        userId: user,
        todoId
      }))(userId);

      return await models.UserTodo.bulkCreate(temp, { returning: true });
    },
    updateTodoStatus: combineResolvers(
      isAuthenticated,
      async (parent, { status, todoId }, { models, me }) => {
        try {
          await models.UserTodo.findOne({
            where: {
              todoId,
              userId: me.id
            },
            rejectOnEmpty: true
          });

          await models.UserTodo.update(
            {
              status
            },
            {
              where: {
                todoId,
                userId: me.id
              }
            }
          );
          const [result] = await models.UserTodo.findAll({
            include: [
              {
                model: models.Todo,
                required: true
              }
            ],
            where: {
              userId: me.id
            }
          });
          return result;
        } catch (e) {
          if (e.name === "SequelizeEmptyResultError")
            throw new UserInputError("No todo found");

          return e;
        }
      }
    )
  },
  Date: GraphQLDate,
  Time: GraphQLTime,
  DateTime: GraphQLDateTime,
  JSON: GraphQLJSON
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
