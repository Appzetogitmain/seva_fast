import mongoose from 'mongoose';

async function run() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/seva_fast');
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
