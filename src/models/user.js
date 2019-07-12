const user = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "user",
    {
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      purchaseFlightTicket: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: "purchase_flight_ticket"
      }
    },
    {
      underscored: true
    }
  );

  User.associate = models => {
    User.hasMany(models.Expense);
  };

  return User;
};

export default user;
