import mongoose from 'mongoose';

mongoose.connect('mongodb://127.0.0.1:27017/seva_fast').then(async () => {
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
    const Seller = mongoose.model('Seller', new mongoose.Schema({}, { strict: false }));

    const prod = await Product.findOne({ name: { $regex: /dettol/i } });
    if (!prod) {
        console.log('Product not found');
    } else {
        console.log('Product:', JSON.stringify(prod, null, 2));
        const seller = await Seller.findById(prod.sellerId);
        console.log('Seller:', JSON.stringify(seller, null, 2));
    }
    process.exit(0);
});
