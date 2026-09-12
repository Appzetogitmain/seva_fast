import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { fetchSellerOrdersPage } from './app/services/orderQueryService.js';
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const sellerId = '6aa1494c28846002369bf474'; // Using same ID as scratch_agg.js
  
  try {
    const result = await fetchSellerOrdersPage({
      role: 'seller',
      userId: sellerId,
      statusParam: undefined,
      startDate: undefined,
      endDate: undefined,
      skip: 0,
      limit: 25,
      assignedZones: []
    });
    console.log('Success:', !!result.orders);
  } catch (err) {
    console.error('Error fetching:', err);
  }

  await mongoose.disconnect();
}
main().catch(console.error);
