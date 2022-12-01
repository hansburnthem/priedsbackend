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
  let data = await stock_read_log.findOne({payload: req.body.payload})
  if(data === null) {
    res.json({statusCode: 0, message: 'No Data'})
    return
  }

  /**
   * @type {Array}
   */
  let qrData = data.qr_list
  for (let i = 0; i < req.body.new_qr_list.length; i++) {
    const element = req.body.new_qr_list[i];
    let oldStockReadLog = await stock_read_log.findOne({qr_list: {$elemMatch: {payload: element.payload}}})
    qrData.push(oldStockReadLog.qr_list.find(el => el.payload === element.payload))
    data.qty++
    oldStockReadLog.qr_list = oldStockReadLog.qr_list.filter(el => el.payload !== element.payload)
    oldStockReadLog.qty--
    await stock_read_log.updateOne({payload: oldStockReadLog.payload}, {qty: oldStockReadLog.qty, qr_list: oldStockReadLog.qr_list})
  }

  // Bagian ini digunakan apabila ingin menghapus rejected qr dari qr_list
  // for (let i = 0; i < req.body.reject_qr_list.length; i++) {
  //   const element = req.body.reject_qr_list[i];
  //   qrData.splice(qrData.findIndex(el => el.payload === element.payload) ,1)
  // }

  // Bagian ini digunakan apabila ingin soft delete rejected qr dari qr_list dengan mengubah status sesuai dengan readme
  for (let i = 0; i < req.body.reject_qr_list.length; i++) {
    const element = req.body.reject_qr_list[i];
    let id = qrData.findIndex(el => el.payload === element.payload)
    qrData[id].status = 0
    qrData[id].status_qc = 1
    data.qty--
  }

  await stock_read_log.updateOne({payload: data.payload}, {qty: data.qty, qr_list: data.qr_list})

  res.json({statusCode: 1, data: data.qr_list.filter(el => el.status === 1)})

})

router.use('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
