const mongoose = require('mongoose');
const AssignmentTemplate = require('./models/AssignmentTemplate');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    
    const templates = await AssignmentTemplate.find({}).sort({ parentFolder: 1, order: 1 });
    
    console.log(`\n📊 Total templates: ${templates.length}\n`);
    
    if (templates.length === 0) {
      console.log('❌ No templates found! Run: node seed-templates.js');
    } else {
      const grouped = {};
      templates.forEach(t => {
        const folder = t.parentFolder || 'Root Level';
        if (!grouped[folder]) grouped[folder] = [];
        grouped[folder].push(t);
      });
      
      Object.entries(grouped).forEach(([folder, temps]) => {
        console.log(`\n📁 ${folder} (${temps.length} templates):`);
        temps.forEach(t => {
          console.log(`   ${t.order.toString().padStart(2, '0')}. ${t.templateName}`);
        });
      });
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
