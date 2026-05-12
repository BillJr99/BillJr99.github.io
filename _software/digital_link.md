---
title: "digital_link"
excerpt: "A DTMF-controlled digital mode and talkgroup switcher for AllStarLink nodes running DVSwitch."
collection: software
comments: true
tags:
  - hamradio
  - technical
  - software
---

This shell script enables an AllStarLink node operator to switch between digital voice modes and talkgroups using DTMF tones sent over the air, without requiring a separate application or computer interface.  The operator transmits a two-digit mode code followed by an optional talkgroup number, and the script instructs DVSwitch to link to the specified network and reflector.  Supported modes include DMR, D-STAR, YSF, NXDN, and P25, and multiple networks within each mode (e.g., Brandmeister and TGIF for DMR, REF and XLX for D-STAR) may be configured simultaneously.  The script integrates with Asterisk through the `rpt.conf` autopatch and `extensions.conf` dialplan, and all mode-to-network mappings are stored in a plain-text configuration file so that new talkgroups can be added without modifying the script itself.

Special handling is included for DMR private calls (appending `D` to the command sequence), D-STAR echo linking, and DMR timeslot selection.  An unlinking command (`*AA0`) disconnects the current digital mode, and a full unlink (`*AA00`) additionally drops the AllStar bridge connection.  The script maintains a log file owned by the Asterisk user that records mode transitions.

This software is distributed under the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html).

The package is hosted on GitHub at:

[DTMF Digital Mode Changer for DVSwitch](https://github.com/BillJr99/digital_link)

## Installation

Clone the repository to `/opt` on your AllStar node:

```bash
cd /opt
git clone https://github.com/BillJr99/digital_link
```

Copy `switch_modes.conf.sample` to `switch_modes.conf` and configure your `NODE_ID`, `LINKED_NODE_ID`, and one section per digital network you wish to use.  The `modemaster` key in each section defines the two-digit DTMF prefix that selects that network.  Then modify `/etc/asterisk/rpt.conf` to add an autopatch entry and `/etc/asterisk/extensions.conf` to route the DTMF string to the script.

## Usage

Assuming `A` is used as the autopatch entry code, the command format is:

```
*AA <mode digit> <master digit> [talkgroup] [D]
```

Examples:
- Connect to REF030C on D-STAR: `*AA 21 030C`
- Connect to TG 91 on DMR Brandmeister: `*AA 11 91`
- Connect to TG 9990 private call on DMR Brandmeister: `*AA 11 9990D`
- Connect to Parrot on YSF: `*AA 31`
- Unlink current mode: `*AA 0`

## Disclaimer

This software is lightly tested and should be treated as beta.  Back up your Asterisk configuration files before deployment, and verify that modes link and unlink correctly in your environment before placing the node into service.
