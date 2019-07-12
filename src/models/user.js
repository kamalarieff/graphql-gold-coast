const user = (sequelize, DataTypes) => {
  const User = sequelize.define("user", {
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    purchaseFlightTicket: {
      type: DataTypes.BOOLEAN,
      default: false,
      field: "purchase_flight_ticket"
    }
  });

  return User;
};

export default user;
