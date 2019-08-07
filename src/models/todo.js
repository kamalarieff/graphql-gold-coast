const todo = (sequelize, DataTypes) => {
  const Todo = sequelize.define(
    "todo",
    {
      item: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      additional_details: {
        type: DataTypes.JSON,
        allowNull: true
      }
    },
    {
      underscored: true
    }
  );

  return Todo;
};

export default todo;
