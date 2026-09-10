import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/seva_fast');
  const db = mongoose.connection.db;
  const txns = await db.collection('transactions').find({ type: 'Delivery Earning' }).sort({ createdAt: -1 }).limit(5).toArray();
  console.log(JSON.stringify(txns, null, 2));
  process.exit(0);
}

run().catch(console.error);
