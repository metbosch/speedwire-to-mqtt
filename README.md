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
 - grid_w. Average active power consumed from grid during the period in W.
 - grid_wh. Grid active energy consumption counter from last received message in Wh.
 - feed_w. Average active power feeded to grid during the period in W.
 - feed_wh. Grid active energy feed counter from last received message in Wh.
 - grid_var. Average reactive power consumed from grid during the period in var.
 - grid_varh. Grid reactive energy consumption counter from last received message in varh.
 - feed_var. Average reactive power feeded to grid during the period in var.
 - feed_varh. Grid reactive energy feed counter from last received message in varh.
 - grid_va. Average apparent power consumed from grid during the period in va.
 - grid_vah. Grid apparent energy consumption counter from last received message in vah.
 - feed_va. Average apparent power feeded to grid during the period in va.
 - feed_vah. Grid apparent energy feed counter from last received message in vah.

## Docker

The service can be run using Docker.
The image can be found at [Docker HUB](https://hub.docker.com/r/metbosch/speedwire-to-mqtt).
Example to run the image with a custom config file (`home.config.json`):

```
docker run -it --rm --net host -v home.config.json:/usr/src/app/config/home.json -e NODE_CONFIG_ENV=home metbosch/speedwire-to-mqtt
```
