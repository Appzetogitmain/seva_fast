const mongoose = require('mongoose');
require('dotenv').config({ path: 'd:/Appzeto/seva_fast/backend/.env' });
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Setting = require('./app/models/setting.js').default;
  const toSet = {};
  const value = {
    productApproval: { sellerCreateRequiresApproval: true, sellerEditRequiresApproval: true }
  };
  function flattenForMongoSet(prefix, value, target) {
    if (value === undefined) return;
    const isPlainObject = value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
    if (!isPlainObject) {
      target[prefix] = value;
      return;
    }
    const keys = Object.keys(value);
    if (!keys.length) {
      target[prefix] = value;
      return;
    }
    for (const key of keys) {
      flattenForMongoSet(prefix + '.' + key, value[key], target);
    }
  }
  for (const [key, v] of Object.entries(value)) {
      if (v === undefined) continue;
      flattenForMongoSet(key, v, toSet);
  }
  console.log('toSet:', toSet);
  
  await Setting.findOneAndUpdate({}, { $set: toSet }, { new: true, upsert: true });
  const settings = await Setting.findOne();
  console.log(JSON.stringify(settings.productApproval, null, 2));
  
  // Revert back
  await Setting.findOneAndUpdate({}, { $set: { 'productApproval.sellerCreateRequiresApproval': false, 'productApproval.sellerEditRequiresApproval': false } });

  process.exit();
}).catch(console.error);
