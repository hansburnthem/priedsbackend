var express = require('express');
var router = express.Router();
const stock_read_log = require('../models/stock_read_log');
const FileSystem = require("fs");

router.use('/export-data', async (req, res) => {
  const list = await stock_read_log.aggregate([
    {
      $match: {}
    }
  ]).exec();
  
  FileSystem.writeFile('./stock_read_log.json', JSON.stringify(list), (error) => {
      if (error) throw error;
  });

  console.log('stock_read_log.json exported!');
  res.json({statusCode: 1, message: 'stock_read_log.json exported!'})
});

router.use('/import-data', async (req, res) => {
  const list = await stock_read_log.aggregate([
    {
      $match: {}
    }
  ]).exec();
  
  FileSystem.readFile('./stock_read_log.json', async (error, data) => {
      if (error) throw error;

      const list = JSON.parse(data);

      const deletedAll = await stock_read_log.deleteMany({});

      const insertedAll = await stock_read_log.insertMany(list);

      console.log('stock_read_log.json imported!');
  res.json({statusCode: 1, message: 'stock_read_log.json imported!'})
  });

  
})

router.use('/edit-repacking-data', async (req, res) => {
  /**
   * @type {stock_read_log}
   */
  const data = await stock_read_log.findOne({payload: req.body.payload})
  if(data === null) {
    res.json({statusCode: 0, message: 'No Data'})
  }

  /**
   * @type {Array}
   */
  let qrData = data.qr_list
  for (let i = 0; i < 1; i++) {
    const element = req.body.new_qr_list[i];
    let dataNew = await stock_read_log.findOne({qr_list: {$elemMatch: {payload: element.payload}}})
    qrData.push(dataNew.qr_list.find(el => el.payload === element.payload))
    // dataNew.qr_list.splice(dataNew.qr_list.indexOf(element.payload), 1)
    dataNew.qr_list = dataNew.qr_list.filter(el => el.payload !== element.payload)
    dataNew.qty = dataNew.qty - 1
    // await stock_read_log.updateOne({qr_list: {$elemMatch: {payload: element.payload}}})
    dataNew.save()
  }
  res.json({statusCode: 1, data: qrData})

})

router.use('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
