const config = require('config');
const dgram = require('dgram');
const mqtt = require('mqtt');

const updClient = dgram.createSocket('udp4');
const mqttClient = mqtt.connect('mqtt://' + config.get('mqtt.url'), config.get('mqtt.options'));
const periodPublish = config.get('period') * 1000;
var handlePublish = undefined;
var gridPower = [];
var gridEnergy = undefined;
var feedPower = [];
var feedEnergy = undefined;

function onError(err) {
  clearTimeout(handlePublish);
  updClient.close();
}

function mqttConnect(err) {
  //TODO: Check err
  console.log('MQTT client connected');
  handlePublish = setTimeout(mqttPublish, periodPublish);
}

function mqttPublish() {
  const samples = parseInt((gridPower.length + feedPower.length)/2);

  if (samples > 0) {
    const data = {
      samples: samples,
      grid_w: gridPower.reduce((a, b) => a+b, 0)/gridPower.length,
      grid_wh: gridEnergy,
      feed_w: feedPower.reduce((a, b) => a+b, 0)/feedPower.length,
      feed_wh: feedEnergy
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
  const address = updClient.address();
  console.log(`listening ${address.address}:${address.port}`);
  updClient.addMembership(config.get('address'));
}

function udpParse(msg, info) {
  var offset, value;

  /* to get the actual grid consumption in W we need the offset 0.1.4.0 */
  offset = msg.indexOf("00010400", 0, "hex")+ 4;
  value = parseInt((msg[offset+0]*0x1000000 + 
                    msg[offset+1]*0x10000 + 
                    msg[offset+2]*0x100  +
                    msg[offset+3]) / 10);
  if (value >= 0 && value < 100000) {
    gridPower.push(value);
  }
  
  /* to get the actual grid consumption counter in Wh we need the offset 0.1.8.0 */
  offset = msg.indexOf("00010800", 0, "hex")+ 4;
  value = parseInt((msg[offset+0]*0x100000000000000 + 
                    msg[offset+1]*0x1000000000000 + 
                    msg[offset+2]*0x10000000000  +
                    msg[offset+3]*0x100000000 +
                    msg[offset+4]*0x1000000 + 
                    msg[offset+5]*0x10000 + 
                    msg[offset+6]*0x100  +
                    msg[offset+7]) / 3600);
  if (value >= 0 && value < 50000000) {
    gridEnergy = value;
  }
  
  /* to get the actual grid feed in W we need the offset 0.2.4.0 */
  offset = msg.indexOf("00020400", 0, "hex")+ 4;
  value = parseInt((msg[offset+0]*0x1000000 + 
                    msg[offset+1]*0x10000 + 
                    msg[offset+2]*0x100  +
                    msg[offset+3]) / 10);
  if (value >= 0 && value < 100000) {
    feedPower.push(value);
  }
  
  /* to get the actual grid feed counter in Wh we need the offset 0.2.8.0 */
  offset = msg.indexOf("00020800", 0, "hex")+ 4;
  value = parseInt((msg[offset+0]*0x100000000000000 + 
                    msg[offset+1]*0x1000000000000 + 
                    msg[offset+2]*0x10000000000  +
                    msg[offset+3]*0x100000000 +
                    msg[offset+4]*0x1000000 + 
                    msg[offset+5]*0x10000 + 
                    msg[offset+6]*0x100  +
                    msg[offset+7]) / 3600);
  if (value >= 0 && value < 5000000) {
    feedEnergy = value;
  }
}

updClient.on('error', onError);
updClient.on('message', udpParse);
updClient.on('listening', udpConnect);
updClient.bind(config.get('port'));
mqttClient.on('connect', mqttConnect);
