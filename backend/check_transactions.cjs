const mongoose = require('mongoose');

async function run() {
  try {
    await mongoose.connect('mongodb+srv://sevafast1214_db_user:JkDgSrHXmmfZInI2@cluster0.ab4y4iw.mongodb.net/?appName=Cluster0');
    const txns = await mongoose.connection.db.collection('transactions').find({ type: 'Delivery Earning' }).sort({ _id: -1 }).limit(10).toArray();
    console.log(JSON.stringify(txns, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
