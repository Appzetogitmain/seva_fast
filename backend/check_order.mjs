import mongoose from 'mongoose';
await mongoose.connect('mongodb+srv://sevafast1214_db_user:JkDgSrHXmmfZInI2@cluster0.ab4y4iw.mongodb.net/?appName=Cluster0');
const Order = mongoose.connection.db.collection('orders');
const last = await Order.findOne({}, { sort: { createdAt: -1 } });
if (!last) { console.log('No orders found'); }
else {
  console.log('Order ID:', last.orderId || String(last._id));
  console.log('Created:', last.createdAt);
  (last.items || []).forEach((item, i) => {
    console.log('[' + (i+1) + '] name=' + item.name + ' | variantSlot=' + (item.variantSlot||'NONE') + ' | variantName=' + (item.variantName||'NONE'));
  });
}
await mongoose.disconnect();
