---
title: "IoT Sensor Framework"
excerpt: "A secure and modular data collection and processing framework for heterogeneous Internet-of-Things (IoT) sensor networks."
collection: software
comments: true
tags:
  - smartfabrics
  - technical
  - software  
---

This software suite contains scripts to collect and store IoT sensor data, such as RFID tag information using an Impinj Speedway RFID reader.  The collection framework interfaces with a heterogeneous suite of devices in real-time, and stores the data in a database or streaming service as defined by the driver configuration.  A corresponding processing suite visualizes the real-time or archived data collected by the collection framework, enabling rapid experimentation and testing of machine learning algorithms on existing and new datasets.  Sensor fusion, ground truth, and data perturbation modules allow for automated and controlled manipulation of the data sets and comparison to ground truth.  It is modular and generalizable to a variety of sensor systems and processing needs.  

![IoT Framework Software Driving an Impinj R420 Interrogator to Visualize Respiratory Patterns on a SimBaby Mannequin Wearing the Passive Bellyband Smart Garment Device](/files/media/software-iotframework/simbaby.jpg "IoT Framework Software Driving an Impinj R420 Interrogator to Visualize Respiratory Patterns on a SimBaby Mannequin Wearing the Passive Bellyband Smart Garment Device")

![IoT Framework Software Driving an Impinj R420 Interrogator to Visualize Respiratory Patterns on a SimBaby Mannequin Wearing the Passive Bellyband Smart Garment Device, with a Pregnant Mannequin Wearing the Bellyband](/files/media/software-iotframework/simbabyandpregnancy.jpg "IoT Framework Software Driving an Impinj R420 Interrogator to Visualize Respiratory Patterns on a SimBaby Mannequin, with a Pregnant Mannequin Wearing the Bellyband")

Information about the architecture of this system can be found in my [Ph.D. Dissertation](/publication/dissertation) and on [this paper](/publication/iotdi2017) detailing the use of the framework on RFID-based sensor systems.

This effort was supported in part by the National Science Foundation, the National Institutes of Health, and the Commonwealth of Pennsylvania.

The packages for data collection and data processing, respectively, are hosted on GitHub at the following locations:

| [![v1.0 Release DOI, 5/5/2020](https://zenodo.org/badge/DOI/10.5281/zenodo.3786932.svg)](https://doi.org/10.5281/zenodo.3786932) [IoT Data Collection Framework](https://github.com/drexelwireless/iot-sensor-framework) | 
[![v1.1 Release DOI, 5/13/2020](https://zenodo.org/badge/DOI/10.5281/zenodo.3786930.svg)](https://doi.org/10.5281/zenodo.3786930) [IoT Data Processing Framework](https://github.com/drexelwireless/iot-processing-framework) |

We have made datasets public from simulated mannequins and emulated environments on [GitHub](https://github.com/drexelwireless/bellyband-datasets).  

## Installation Videos

### iot-software-framework
<iframe width="560" height="315" src="https://www.youtube.com/embed/NOFdUsx6Fuk" frameborder="0" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen>
</iframe>

### iot-processing-framework
<iframe width="560" height="315" src="https://www.youtube.com/embed/KdaFo_KRPlE" frameborder="0" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen>
</iframe>

### Running the Software
<iframe width="560" height="315" src="https://www.youtube.com/embed/wwc1o67mbcw" frameborder="0" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen>
</iframe>

## IoT Data Collection Framework bibtex
```bibtex
@misc{githubiotsensorframework,
    author       = {William M. Mongan and Ilhaan Rasheed and Enioluwa Segun and Henry Dang and Victor S. Cushman and Charlie R. Chiccarine and Kapil R. Dandekar and Adam K. Fontecchio},
    title        = {drexelwireless/iot-sensor-framework: Public Release 1.0},
    month        = may,
    year         = 2020,
    doi          = {10.5281/zenodo.3786932},
    version      = {v1.0},
    publisher    = {Zenodo},
    url          = {https://doi.org/10.5281/zenodo.3786932}
}
```

## IoT Data Processing Framework bibtex
```bibtex
@misc{githubiotprocessingframework,
    author       = {William M. Mongan and Kapil R. Dandekar and Adam K. Fontecchio},
    title        = {drexelwireless/iot-processing-framework: Public Release 1.1},
    month        = may,
    year         = 2020,
    doi          = {10.5281/zenodo.3786930},
    version      = {v1.1},
    publisher    = {Zenodo},
    url          = {https://doi.org/10.5281/zenodo.3786930}
}
```
