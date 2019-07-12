const expense = (sequelize, DataTypes) => {
  const Expense = sequelize.define("expense", {
    item: {
      type: DataTypes.STRING,
      allowNull: false
    },
    value: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      validate: {
        is: /^[0-9]+(\.[0-9]{2})?$/i
      }
    },
    sharedWith: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      defaultValue: null,
      field: "shared_with"
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: "RM"
    }
  });

  return Expense;
};

export default expense;
