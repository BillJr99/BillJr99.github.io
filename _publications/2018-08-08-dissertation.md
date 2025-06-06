---
title: "Predictive Analytics on Real-Time Biofeedback for Actionable Classification of Activity State"
collection: publications
category: theses
permalink: /publication/dissertation
excerpt: 'Ph.D. Dissertation'
date: '2018-08-08'
venue: 'Drexel University'
paperurl: '/files/mongan-dissertation.pdf'
citation: 'Mongan, William M. (2018). Predictive Analytics on Real-Time Biofeedback for Actionable Classification of Activity State.  PhD Dissertation, Drexel University.'
tags:
  - technical
  - thesis
  - smartfabrics
---
Download the presentation [here](/files/mongan-dissertation-presentation.pdf)  
Download the paper [here](/files/mongan-dissertation.pdf)

## bibtex
```bibtex
@phdthesis{WMonganPhD,
author    = {Mongan, William M.},
title     = {Predictive Analytics on Real-Time Biofeedback for Actionable Classification of Activity State},
year      = {2018},
school    = {Drexel University},
address   = {Philadelphia, PA USA},
}
```

# Abstract:

Continuous biomedical monitoring has the potential to improve quality-of-care for patients as well as working conditions for medical practitioners over the current state-of-the-art. Currently, Emergency Medical Technicians in the field carry monitoring equipment that can weigh over 50 lbs, and manually communicate information back to hospital physicians.  For patients, medical monitoring is carried out using tethered equipment that must remain attached for hours or days, and must be removed when the patient must get up to walk or use the restroom.  Data lapses during these disconnected breaks can be misinterpreted by medical staff as a medical event, and true medical events can be missed as a result of non-monitoring.  Further, being still for extended periods of time can exacerbate the very risks being treated, due to the increased risk of a blood clot while remaining stationary during monitoring.  

Radio Frequency Identification (RFID) technology is traditionally used as a battery-free chip embedded into an item for inventory management.  As the chip is placed within the field of an RFID interrogator, one or more interrogation waves are reflected off of the chip and observed at the interrogator site.  The reflected signal is encoded by the chip with an identifier which is typically used for inventory purposes.  Multiple interrogation signals are typically employed to overcome collisions and to ensure that a viable interrogation takes place while the chip is in range of the interrogator.  We take advantage of this property of RFID technology by knitting a metallic antenna around the tag and embedding the system into a wearable garment in an unobtrusive way.  We re-purpose the use of RFID by observing small perturbations in the physical properties of the reflected signal for each interrogation of the tag.  As the wearer moves about, changes in the knit antenna shape result in changes to the properties of the reflected signal as it is regularly and frequently polled by the interrogator.  These physical changes are small and subject to noise interference both from RF, movements in the environment around the subject, and movements by the subject directly; however, we fuse signal processing and machine learning approaches to estimate biomedical properties of the wearer such as respiratory rate, apnea, uterine contractions, and stationary limbs.  As a result, we introduce a wearable technology platform supported by real-time analytical software that enables unobtrusive, continuous, ambulatory monitoring of strain or movement biomedical artifacts.