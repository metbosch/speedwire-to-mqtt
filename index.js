const config = require('config');
const dgram = require('dgram');
const mqtt = require('mqtt');

const udpClient = dgram.createSocket('udp4');
const mqttClient = mqtt.connect('mqtt://' + config.get('mqtt.url'), config.get('mqtt.options'));
const periodPublish = config.get('period') * 1000;
var handlePublish = undefined;
var gridPower = [];
var gridEnergy = undefined;
var feedPower = [];
var feedEnergy = undefined;

function onError(err) {
  clearTimeout(handlePublish);
  udpClient.close();
}

function mqttConnect(err) {
  //TODO: Check err
  console.log('MQTT client connected');
  handlePublish = setTimeout(mqttPublish, periodPublish);
}

function mqttPublish() {
  const samples = parseInt((gridPower.length + feedPower.length)/2);

  if (samples > 0) {
    const meanGridPower = gridPower.reduce((a, b) => a+b, 0)/gridPower.length;
    const meanFeedPower = feedPower.reduce((a, b) => a+b, 0)/feedPower.length;
    const data = {
      samples: samples,
      grid_w: meanGridPower.toString(),
      grid_wh: gridEnergy.toString(),
      feed_w: meanFeedPower.toString(),
      feed_wh: feedEnergy.toString()
    };
    mqttClient.publish(config.get('mqtt.topic'), JSON.stringify(data));

    // Cleanup
    gridPower = [];
    gridEnergy = undefined;
    feedPower = [];
    feedEnergy = undefined;
  }

  // Schedule next publish
  handlePublish = setTimeout(mqttPublish, periodPublish);
}

function udpConnect() {
  const address = udpClient.address();
  console.log('Listening ' + address.address + ":" + address.port);
  udpClient.addMembership(config.get('address'));
}

function udpParse(msg, info) {
  const REGS_OFFSET = 4;
  const MAX_ENERGY  = 1000000000000;
  const MAX_POWER   = 10000000;
  var offset, value;

  /* check SMA header */
  value = msg.toString("hex", 0, 4);
  if (value != "534d4100") {
    console.log('ERROR: Invalid datagram header found: "' + value + '", discarting it.');
    return;
  }

  /* to get the actual grid consumption in W we need the offset 0.1.4.0 */
  offset = msg.indexOf("00010400", REGS_OFFSET, "hex");
  if (offset != -1) {
    value = msg.readInt32BE(offset + 4)/3600;
    if (value >= 0 && value < MAX_POWER) {
      gridPower.push(value);
    }
  }
  
  /* to get the actual grid consumption counter in Wh we need the offset 0.1.8.0 */
  offset = msg.indexOf("00010800", REGS_OFFSET, "hex");
  if (offset != -1) {
    value = msg.readBigInt64BE(offset + 4)/3600n;
    if (value >= 0 && value < MAX_ENERGY) {
      gridEnergy = value;
    }
  }
  
  /* to get the actual grid feed in W we need the offset 0.2.4.0 */
  offset = msg.indexOf("00020400", REGS_OFFSET, "hex");
  if (offset != -1) {
    value = msg.readInt32BE(offset + 4)/3600;
    if (value >= 0 && value < MAX_POWER) {
      feedPower.push(value);
    }
  }
  
  /* to get the actual grid feed counter in Wh we need the offset 0.2.8.0 */
  offset = msg.indexOf("00020800", REGS_OFFSET, "hex");
  if (offset != -1) {
    value = msg.readBigInt64BE(offset + 4)/3600n;
    if (value >= 0 && value < MAX_ENERGY) {
      feedEnergy = value;
    }
  }
}

udpClient.on('error', onError);
udpClient.on('message', udpParse);
udpClient.on('listening', udpConnect);
udpClient.bind(config.get('port'));
mqttClient.on('connect', mqttConnect);
