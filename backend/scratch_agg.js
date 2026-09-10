import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from './app/models/order.js';
import User from './app/models/customer.js';
import Seller from './app/models/seller.js';
import Product from './app/models/product.js';
import Category from './app/models/category.js';
import Delivery from './app/models/delivery.js';
import { getSellerStats } from './app/controller/sellerStatsController.js';
dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const sellerId = '6aa1494c28846002369bf474';
  
  const req = {
    user: { id: sellerId, role: 'seller' },
    query: { range: 'daily' }
  };
  let sentStatus = null;
  let sentData = null;
  const res = {
    status: (code) => {
      sentStatus = code;
      return {
        json: (data) => { sentData = data; return data; }
      };
    }
  };

  await getSellerStats(req, res);
  console.log('Status:', sentStatus);
  console.log('Result:', JSON.stringify(sentData, null, 2));

  await mongoose.disconnect();
}
main().catch(console.error);
