const userTodo = (sequelize, DataTypes) => {
  const UserTodo = sequelize.define(
    "userTodo",
    {
      status: {
        type: DataTypes.STRING,
        allowNull: false
      },
      userId: {
        type: DataTypes.INTEGER,
        unique: "compositeIndex"
      },
      todoId: {
        type: DataTypes.INTEGER,
        unique: "compositeIndex"
      }
    },
    {
      underscored: true
    }
  );

  UserTodo.associate = models => {
    UserTodo.belongsTo(models.Todo);
    UserTodo.belongsTo(models.User);
  };

  return UserTodo;
};

export default userTodo;
