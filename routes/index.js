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
  // logic flow: post json -> retrieve stock read log data using json.paylaod and json.company_id -> 
  // check if data not found on db -> looping array new qr (retrieve stock read log using new_qr_list[idx].payload -> check if data null -> 
  // push the main stock read log qr_list using the new qr -> +1 qty to main stock read log -> update qty and qr_list stock read log from new_qr_list[idx].payload ) ->
  // looping array reject qr (find the index from the main stock_read_log.qr_list -> check if not found -> -1 qty to main stock read log -> change the status and status_qc to 0 and 1) ->
  // update the main stock read log data.
  // I use soft delete method to remove the qr from qr_list and retrieve the qr_list using filter.

  /**
   * @type {stock_read_log}
   */
  let data = await stock_read_log.findOne({payload: req.body.payload, company_id: req.body.company_id})
  if(data === null) return res.json({statusCode: 0, message: 'No Data'})
    
  /**
   * @type {Array}
   */
  let qrData = data.qr_list
  
  // Uncomment this code section if want to use mongo transaction, requirement: mongo replica set 
  //#region from this
  // const session = await stock_read_log.startSession()
  // session.startTransaction()

  // try {
  //   for (const element of req.body.new_qr_list) {
  //     let oldStockReadLog = await stock_read_log.findOne({qr_list: {$elemMatch: {payload: element.payload}}})
  //     if(oldStockReadLog === null) throw new Error(`${element.payload} not found in database`)
  //     qrData.push(oldStockReadLog.qr_list.find(el => el.payload === element.payload))
  //     data.qty++
  //     await stock_read_log.updateOne({
  //       payload: oldStockReadLog.payload}, {
  //         qty: --oldStockReadLog.qty, 
  //         qr_list: oldStockReadLog.qr_list.filter(el => el.payload !== element.payload)
  //       }, { session: session })
  //   }
  
  //   for (const element of req.body.reject_qr_list) {
  //     const id = qrData.findIndex(el => el.payload === element.payload)
  //     if(id === -1) throw new Error(`${element.payload} not found in ${data.payload} qr_list`)
  //     data.qty--
  
  //     // splice array qr apabila ingin menghapus data dari db
  //     // qrData.splice(id ,1) 

  //     qrData[id].status = 0
  //     qrData[id].status_qc = 1
  //   }
  
  //   await stock_read_log.updateOne({payload: data.payload}, {qty: data.qty, qr_list: data.qr_list}, {session: session})
  //   await session.commitTransaction()
  //   session.endSession()
  // } catch (error) {
  //   await session.abortTransaction()
  //   session.endSession()
  //   return res.json({statusCode: 0, message: error.message})
  // }
  //#endregion to this

  for (const element of req.body.new_qr_list) {
    let oldStockReadLog = await stock_read_log.findOne({qr_list: {$elemMatch: {payload: element.payload}}})
    if(oldStockReadLog === null) return res.json({statusCode: 0, message: `${element.payload} not found in database`})
    qrData.push(oldStockReadLog.qr_list.find(el => el.payload === element.payload))
    data.qty++
    await stock_read_log.updateOne({
      payload: oldStockReadLog.payload}, {
        qty: --oldStockReadLog.qty, 
        qr_list: oldStockReadLog.qr_list.filter(el => el.payload !== element.payload)
      })
  }

  for (const element of req.body.reject_qr_list) {
    const id = qrData.findIndex(el => el.payload === element.payload)
    if(id === -1) return res.json({statusCode: 0, message: `${element.payload} not found in ${data.payload} qr_list`})
    data.qty--

    // splice array qr and comment the qrData[id].status and status_qc if didn't want to use soft delete
    // qrData.splice(id ,1) 

    qrData[id].status = 0
    qrData[id].status_qc = 1
  }

  await stock_read_log.updateOne({payload: data.payload}, {qty: data.qty, qr_list: data.qr_list})

  res.json({statusCode: 1, message: 'Success edit repacking data', data: data.qr_list.filter(el => el.status === 1)})

})

router.use('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
