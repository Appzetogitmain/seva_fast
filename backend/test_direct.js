import mongoose from "mongoose";

const uri = "mongodb://sevafast1214_db_user:sevafast123@ac-md4v265-shard-00-00.ndcljo6.mongodb.net:27017,ac-md4v265-shard-00-01.ndcljo6.mongodb.net:27017,ac-md4v265-shard-00-02.ndcljo6.mongodb.net:27017/seva?ssl=true&replicaSet=atlas-2cyz1u-shard-0&authSource=admin&retryWrites=true&w=majority";

mongoose.connect(uri)
  .then(() => {
    console.log("Connected directly successfully!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Direct connection error:", err);
    process.exit(1);
  });
