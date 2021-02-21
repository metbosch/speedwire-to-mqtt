Speedwire to MQTT
=================

Service to listen UDP multicast messages from SMA devices and forward the information to a MQTT server.

## Configuration

This is an under-development work, so the configuration options may change at any point.
See the `config/default.json` file to check the available options. They should be self descriptive.
See the [config module](https://www.npmjs.com/package/config) documentation to get the information about how to change the options (or just edit the default file).

## Exported data

The service published a MQTT message every `mqtt.period` seconds to `mqtt.topic` topic.
The message contains a JSON with the following format information:

 - samples. Number of UDP messages received and correctly parsed since last publish.
 - grid_w. Average power consumed from grid during the period in W.
 - grid_wh. Grid energy consumption counter from last received message in Wh.
 - feed_w. Average power feeded to grid during the period in W.
 - feed_wh. Grid energy feed counter from last received message in Wh.
