const config = require('config');
const dgram = require('dgram');
const mqtt = require('mqtt');

const udpClient = dgram.createSocket('udp4');
const mqttClient = mqtt.connect('mqtt://' + config.get('mqtt.url'), config.get('mqtt.options'));
const periodPublish = config.get('period') * 1000;
var handlePublish = undefined;

// Active power/energy
var gridP = [];
var gridPEn = undefined;
var feedP = [];
var feedPEn = undefined;

// Reactive power/energy
var gridQ = [];
var gridQEn = undefined;
var feedQ = [];
var feedQEn = undefined;

// Apparent power/energy
var gridS = [];
var gridSEn = undefined;
var feedS = [];
var feedSEn = undefined;

// L1
var l1A = [];
var l1V = [];
var l1F = [];

// L2
var l2A = [];
var l2V = [];
var l2F = [];

// L3
var l3A = [];
var l3V = [];
var l3F = [];

function onError(err) {
  console.error('UDP error: ' + err);
  clearTimeout(handlePublish);
  udpClient.close();
}

function mqttConnect(err) {
  //TODO: Check err
  console.log('MQTT client connected');
  handlePublish = setTimeout(mqttPublish, periodPublish);
}

function mqttPublish() {
  const samples = parseInt((gridP.length + feedP.length)/2);

  if (samples > 0) {
    const meanGridP = gridP.reduce((a, b) => a+b, 0)/gridP.length;
    const meanFeedP = feedP.reduce((a, b) => a+b, 0)/feedP.length;
    const meanGridQ = gridQ.reduce((a, b) => a+b, 0)/gridQ.length;
    const meanFeedQ = feedQ.reduce((a, b) => a+b, 0)/feedQ.length;
    const meanGridS = gridS.reduce((a, b) => a+b, 0)/gridS.length;
    const meanFeedS = feedS.reduce((a, b) => a+b, 0)/feedS.length;
    const meanl1A = l1A.reduce((a, b) => a+b, 0)/l1A.length;
    const meanl1V = l1V.reduce((a, b) => a+b, 0)/l1V.length;
    const meanl1F = l1F.reduce((a, b) => a+b, 0)/l1F.length;
    const meanl2A = l2A.reduce((a, b) => a+b, 0)/l2A.length;
    const meanl2V = l2V.reduce((a, b) => a+b, 0)/l2V.length;
    const meanl2F = l2F.reduce((a, b) => a+b, 0)/l2F.length;
    const meanl3A = l3A.reduce((a, b) => a+b, 0)/l3A.length;
    const meanl3V = l3V.reduce((a, b) => a+b, 0)/l3V.length;
    const meanl3F = l3F.reduce((a, b) => a+b, 0)/l3F.length;
    const data = {
      samples: samples,
      grid_w: meanGridP,
      grid_wh: Number(gridPEn),
      feed_w: meanFeedP,
      feed_wh: Number(feedPEn),
      grid_var: meanGridQ,
      grid_varh: Number(gridQEn),
      feed_var: meanFeedQ,
      feed_varh: Number(feedQEn),
      grid_va: meanGridS,
      grid_vah: Number(gridSEn),
      feed_va: meanFeedS,
      feed_vah: Number(feedSEn),
      l1: {
        a: meanl1A,
        v: meanl1V,
        f: meanl1F,
      },
      l2: {
        a: meanl2A,
        v: meanl2V,
        f: meanl2F,
      },
      l3: {
        a: meanl3A,
        v: meanl3V,
        f: meanl3F,
      },
    };
    mqttClient.publish(config.get('mqtt.topic'), JSON.stringify(data));

    // Cleanup
    gridP = [];
    gridPEn = undefined;
    feedP = [];
    feedPEn = undefined;
    gridQ = [];
    gridQEn = undefined;
    feedQ = [];
    feedQEn = undefined;
    gridS = [];
    gridSEn = undefined;
    feedS = [];
    feedPEn = undefined;
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
  const MAX_CURRENT = 100000;
  const MAX_ENERGY  = 1000000000000;
  const MAX_FACTOR  = 1000;
  const MAX_POWER   = 10000000;
  const MAX_VOLTAGE = 100000;
  var value;

  /* check SMA header */
  value = msg.toString("hex", 0, 4);
  if (value != "534d4100") {
    console.log('ERROR: Invalid datagram header found: "' + value + '", discarting it.');
    return;
  }

  function getReg32b(reg, minVal, maxVal) {
    const off = msg.indexOf(reg, REGS_OFFSET, "hex");
    if (off != -1) {
      const v = msg.readInt32BE(off + 4)/10;
      if (v >= minVal && v < maxVal) return v;
    }
    return null;
  }

  function getReg64b(reg, minVal, maxVal) {
    const off = msg.indexOf(reg, REGS_OFFSET, "hex");
    if (off != -1) {
      const v = msg.readBigInt64BE(off + 4)/3600n;
      if (v >= minVal && v < maxVal) return v;
    }
    return null;
  }

  /* to get the actual grid consumption in W we need the offset 0.1.4.0 */
  value = getReg32b("00010400", 0, MAX_POWER);
  if (value !== null) gridP.push(value); 
  
  /* to get the actual grid consumption counter in Wh we need the offset 0.1.8.0 */
  value = getReg64b("00010800", 0, MAX_ENERGY);
  if (value !== null) gridPEn = value; 
  
  /* to get the actual grid feed in W we need the offset 0.2.4.0 */
  value = getReg32b("00020400", 0, MAX_POWER);
  if (value !== null) feedP.push(value); 
  
  /* to get the actual grid feed counter in Wh we need the offset 0.2.8.0 */
  value = getReg64b("00020800", 0, MAX_ENERGY);
  if (value !== null) feedPEn = value; 

  /* to get the actual grid reactive consumption in var we need the offset 0.3.4.0 */
  value = getReg32b("00030400", 0, MAX_POWER);
  if (value !== null) gridQ.push(value); 
  
  /* to get the actual grid reactive consumption counter in varh we need the offset 0.3.8.0 */
  value = getReg64b("00030800", 0, MAX_ENERGY);
  if (value !== null) gridQEn = value; 
  
  /* to get the actual grid reactive feed in var we need the offset 0.4.4.0 */
  value = getReg32b("00040400", 0, MAX_POWER);
  if (value !== null) feedQ.push(value); 
  
  /* to get the actual grid reactive feed counter in varh we need the offset 0.4.8.0 */
  value = getReg64b("00040800", 0, MAX_ENERGY);
  if (value !== null) feedQEn = value;

  /* to get the actual grid apparent consumption in VA we need the offset 0.9.4.0 */
  value = getReg32b("00090400", 0, MAX_POWER);
  if (value !== null) gridS.push(value); 
  
  /* to get the actual grid apparent consumption counter in VAh we need the offset 0.9.8.0 */
  value = getReg64b("00090800", 0, MAX_ENERGY);
  if (value !== null) gridSEn = value; 
  
  /* to get the actual grid apparent feed in VA we need the offset 0.10.4.0 */
  value = getReg32b("000A0400", 0, MAX_POWER);
  if (value !== null) feedS.push(value); 
  
  /* to get the actual grid apparent feed counter in VAh we need the offset 0.10.8.0 */
  value = getReg64b("000A0800", 0, MAX_ENERGY);
  if (value !== null) feedSEn = value;

  /* to get the actual L1 current in A we need the offset 0.31.4.0 */
  value = getReg32b("001F0400", 0, MAX_CURRENT);
  if (value !== null) l1A.push(value/100.0);

  /* to get the actual L1 voltage in V we need the offset 0.32.4.0 */
  value = getReg32b("00200400", 0, MAX_VOLTAGE);
  if (value !== null) l1V.push(value/100.0); 

  /* to get the actual L1 factor we need the offset 0.33.4.0 */
  value = getReg32b("00210400", 0, MAX_FACTOR);
  if (value !== null) l1F.push(value/100.0);

  /* to get the actual L2 current in A we need the offset 0.51.4.0 */
  value = getReg32b("00330400", 0, MAX_CURRENT);
  if (value !== null) l2A.push(value/100.0);

  /* to get the actual L2 voltage in V we need the offset 0.52.4.0 */
  value = getReg32b("00340400", 0, MAX_VOLTAGE);
  if (value !== null) l2V.push(value/100.0);

  /* to get the actual L2 factor we need the offset 0.53.4.0 */
  value = getReg32b("00350400", 0, MAX_FACTOR);
  if (value !== null) l2F.push(value/100.0);

  /* to get the actual L3 current in A we need the offset 0.71.4.0 */
  value = getReg32b("00470400", 0, MAX_CURRENT);
  if (value !== null) l3A.push(value/100.0);

  /* to get the actual L3 voltage in V we need the offset 0.72.4.0 */
  value = getReg32b("00480400", 0, MAX_VOLTAGE);
  if (value !== null) l3V.push(value/100.0);

  /* to get the actual L3 factor we need the offset 0.73.4.0 */
  value = getReg32b("00490400", 0, MAX_FACTOR);
  if (value !== null) l3F.push(value/100.0);
}

udpClient.on('error', onError);
udpClient.on('message', udpParse);
udpClient.on('listening', udpConnect);
udpClient.bind(config.get('port'));
mqttClient.on('connect', mqttConnect);
