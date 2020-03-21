---
title: "Passive Wearable Smart Garment Devices"
excerpt: "Using Radio Frequency Identification to enable functional wearable devices"
collection: portfolio
comments: true
tags:
  - smartfabrics
---

Using the [IOT Sensor Framework](/portfolio/iotframework/) for signal processing and machine learning, the [Drexel Wireless Systems Lab](https://wireless.ece.drexel.edu) and collaborators across Drexel University have developed [wearable textile smart garment devices](https://research.coe.drexel.edu/ece/dwsl/research/biomedical-smart-textiles/) for biomedical monitoring (among other) applications.  

I have been fortunate to work with this multidisciplinary team, synthesizing my interests in machine learning and signal processing with electrical engineers, sociologists, neonatologists, pediatricians, and other areas of expertise that span the university.  

Under this project, I developed and open-sourced the [IoT Sensor Framework](/portfolio/iotframework/) for interfacing with heterogeneous IoT sensor suites for ongoing and real-time monitoring.

# Publications
{% for post in site.publications reversed %}
  {% if post.tags contains "smartfabrics" %}
    {% include archive-single-cv.html %}
  {% endif %}
{% endfor %}

# Talks
{% for post in site.talks reversed %}
  {% if post.tags contains "smartfabrics" %}
    {% include archive-single-talk-cv.html %}
  {% endif %}
{% endfor %}

# In the Media
* [These Smart Threads Could Save Lives](/posts/2016/09/sciencenation).  The National Science Foundation (NSF) Science Nation.  September, 2016.