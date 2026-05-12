---
title: "pxt-ESP8266_VarIOT"
excerpt: "A MakeCode extension for the BBC micro:bit that enables telemetry upload to a VarIOT ThingsBoard IoT gateway over WiFi using an ESP8266 module."
collection: software
comments: true
tags:
  - iot
  - education
  - technical
  - software
---

This MakeCode extension allows a BBC micro:bit to send sensor telemetry to a [VarIOT](https://github.com/variotproject/variot) ThingsBoard gateway over a WiFi connection established through an ESP8266 serial WiFi module.  The extension provides block-based programming primitives for initializing the WiFi module, configuring the gateway's IP address and port, and posting JSON telemetry payloads to the gateway's REST endpoint.  Data sent to the VarIOT gateway is then forwarded to a ThingsBoard server for visualization, dashboarding, and further analysis.

The extension was developed by forking the [alankrantas/pxt-ESP8266_ThingSpeak](https://github.com/alankrantas/pxt-ESP8266_ThingSpeak) repository and adapting the underlying WiFi connection and TCP code to target the VarIOT REST API rather than ThingSpeak.  Sensor readings such as temperature, humidity, or biomedical signals (e.g., respiratory rate derived from a wearable device) can be transmitted from the micro:bit to a Raspberry Pi running the VarIOT gateway stack.

This extension is distributed under the [MIT License](https://opensource.org/licenses/MIT).

The extension is hosted on GitHub and is importable directly in the MakeCode editor:

[pxt-ESP8266_VarIOT MakeCode Extension](https://github.com/BillJr99/pxt-ESP8266_VarIOT)

## Installation

To import the extension into a micro:bit project, open [makecode.microbit.org](https://makecode.microbit.org), click the settings gear, choose **Extensions**, and search for `VarIOT`, or paste the repository URL directly:

```
https://github.com/BillJr99/pxt-ESP8266_VarIOT
```

## Wiring

Connect the ESP8266 WiFi module to the micro:bit as follows: the module's Rx pin to P0 (micro:bit Tx), the module's Tx pin to P1 (micro:bit Rx), VCC and CH_EN to the 3V pin, and GND to the ground pin.

## Usage

The extension exposes three blocks for use in a micro:bit program:

1. **Initialize ESP8266**: Configure the serial pins (P0/P1) and set your WiFi SSID and password.  Call this block in the `on start` handler.
2. **Configure VarIOT gateway location**: Provide the IP address and port of the Raspberry Pi running the VarIOT gateway.  Call this block after WiFi initialization.
3. **Upload data to VarIOT**: Specify an endpoint name, a label, and a numeric sensor value to post a telemetry reading to the gateway.

A companion blog post describes the complete hardware setup and configuration of the ThingsBoard gateway: [Integrating the micro:bit with VarIOT via ThingsBoard](/posts/2022/07/variotmicrobit/).
